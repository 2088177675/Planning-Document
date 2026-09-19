# -*- coding: utf-8 -*-
"""公开竞赛模块：广场、发布、报名/组队、作品提交、发布者后台、评分结算、资料下载"""
import json
from flask import (Blueprint, request, redirect, url_for, flash, render_template, g,
                   send_from_directory, abort)
from db import q, qone, execute, UPLOAD_DIR
from auth import login_required, member_required
import services
from files import save_upload

bp = Blueprint('comp', __name__, url_prefix='/competitions')

STATUS_LABELS = {
    'pending': '待审核', 'open': '进行中', 'ended': '待结算',
    'settled': '已结算', 'failed': '已流标', 'terminated': '已终止', 'rejected': '已驳回',
}
DIFFICULTIES = ['入门', '简单', '中等', '困难', '专家']


def comp_phase(comp, t=None):
    t = t or services.now()
    if comp['status'] != 'open':
        return STATUS_LABELS.get(comp['status'], comp['status'])
    if comp['signup_end'] and t > comp['signup_end']:
        if comp['submit_deadline'] and t <= comp['submit_deadline']:
            return '作答中'
        return '已截止'
    return '报名中'


def my_signup(comp_id, user_id):
    return qone('SELECT * FROM comp_signups WHERE competition_id=? AND user_id=?', (comp_id, user_id))


def leaderboard(comp):
    """返回排行榜行：最新作品 + 提交者/队伍信息，按分数降序、最早提交升序"""
    cid = comp['id']
    subs = q('''SELECT s.*, u.username, u.real_name, t.name AS team_name
                FROM submissions s JOIN users u ON u.id=s.user_id
                LEFT JOIN teams t ON t.id=s.team_id
                WHERE s.competition_id=? ORDER BY s.submitted_at ASC''', (cid,))
    latest = {}
    for s in subs:
        key = s['team_id'] if (comp['mode'] == 'team' and s['team_id']) else s['user_id']
        if key not in latest or s['submitted_at'] > latest[key]['submitted_at']:
            latest[key] = s
    rows = list(latest.values())
    rows.sort(key=lambda s: (-(s['score'] if s['score'] is not None else -1), s['submitted_at']))
    return rows


# ---------------- 竞赛广场 ----------------

@bp.route('/')
def list_view():
    status = request.args.get('status', '')
    subject = request.args.get('subject', '').strip()
    sort = request.args.get('sort', 'new')
    sql = '''SELECT c.*, u.username AS publisher_name,
             (SELECT COUNT(*) FROM comp_signups s WHERE s.competition_id=c.id) AS signup_count
             FROM competitions c JOIN users u ON u.id=c.publisher_id
             WHERE c.status IN ('open','ended','settled','failed','terminated')'''
    args = []
    if status:
        sql += ' AND c.status=?'
        args.append(status)
    if subject:
        sql += ' AND c.subject LIKE ?'
        args.append('%' + subject + '%')
    sql += ' ORDER BY ' + {'prize': 'c.prize_amount DESC', 'new': 'c.created_at DESC',
                           'end': 'c.submit_deadline ASC'}.get(sort, 'c.created_at DESC')
    comps = q(sql, args)
    subjects = [r['subject'] for r in q("SELECT DISTINCT subject FROM competitions WHERE subject<>''")]
    return render_template('comps/list.html', comps=comps, status=status, subject=subject,
                           sort=sort, subjects=subjects, STATUS=STATUS_LABELS, phase=comp_phase)


# ---------------- 发布竞赛 ----------------

@bp.route('/publish', methods=['GET', 'POST'])
@member_required
def publish():
    if request.method == 'POST':
        f = request.form
        title = f.get('title', '').strip()
        prize = f.get('prize_amount', '0')
        try:
            prize = round(float(prize), 2)
        except ValueError:
            prize = 0
        if not title:
            flash('请填写竞赛标题', 'error')
            return render_template('comps/publish.html', difficulties=DIFFICULTIES)
        if prize <= 0:
            flash('冠军奖金金额必须大于 0', 'error')
            return render_template('comps/publish.html', difficulties=DIFFICULTIES)
        if g.user['balance'] < prize:
            flash('账户余额不足（需托管 ¥%.2f，当前余额 ¥%.2f），请先到个人中心充值' % (prize, g.user['balance']), 'error')
            return render_template('comps/publish.html', difficulties=DIFFICULTIES)

        mode = f.get('mode', 'individual')
        team_size_max = int(f.get('team_size_max') or 1)
        team_count_max = int(f.get('team_count_max') or 0) or None
        participant_limit = int(f.get('participant_limit') or 0) or None
        eval_mode = f.get('eval_mode', 'manual')
        tie_breaker = f.get('tie_breaker', 'earliest')
        if mode == 'team' and team_size_max < 2:
            team_size_max = 2

        cur = execute(
            '''INSERT INTO competitions
               (publisher_id, title, intro, background, subject, difficulty, audience, mode,
                team_size_max, team_count_max, participant_limit, signup_start, signup_end,
                contest_start, submit_deadline, result_time, prize_amount, eval_mode,
                tie_breaker, status, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (g.user['id'], title, f.get('intro', '').strip(), f.get('background', '').strip(),
             f.get('subject', '').strip(), f.get('difficulty', '').strip(), f.get('audience', '').strip(),
             mode, team_size_max, team_count_max, participant_limit,
             f.get('signup_start'), f.get('signup_end'), f.get('contest_start'),
             f.get('submit_deadline'), f.get('result_time'), prize, eval_mode, tie_breaker,
             'pending', services.now()))
        cid = cur.lastrowid

        # 资料上传（3 个固定槽位：类型 + 文件）
        for i in range(3):
            kind = f.get('mat_kind_%d' % i, '').strip()
            fs = request.files.get('mat_file_%d' % i)
            if fs and fs.filename:
                orig, stored = save_upload(fs)
                if orig:
                    execute('''INSERT INTO comp_materials (competition_id, kind, filename, stored_name, created_at)
                               VALUES (?,?,?,?,?)''', (cid, kind, orig, stored, services.now()))

        # 自动评测：客观题标准答案
        if eval_mode == 'auto':
            q_contents = f.getlist('q_content')
            q_answers = f.getlist('q_answer')
            q_scores = f.getlist('q_score')
            qno = 1
            for qc, qa, qs in zip(q_contents, q_answers, q_scores):
                qc, qa = qc.strip(), qa.strip()
                if qc and qa:
                    try:
                        sc = float(qs or 10)
                    except ValueError:
                        sc = 10.0
                    execute('INSERT INTO comp_questions (competition_id, qno, content, answer, score) VALUES (?,?,?,?,?)',
                            (cid, qno, qc, qa, sc))
                    qno += 1

        # 奖金托管（发布即预缴）
        services.escrow(g.user['id'], prize, 'competition', cid, '发布竞赛，奖金托管')

        # 管理员发布官方竞赛 -> 自动审核通过
        if g.user['role'] == 'admin':
            execute("UPDATE competitions SET status='open', reviewed_at=? WHERE id=?", (services.now(), cid))
            flash('官方竞赛发布成功，已自动审核上线，奖金 ¥%.2f 已托管' % prize, 'ok')
        else:
            flash('竞赛已提交，奖金 ¥%.2f 已托管冻结，等待管理员审核' % prize, 'ok')
        return redirect(url_for('comp.detail', cid=cid))

    return render_template('comps/publish.html', difficulties=DIFFICULTIES)


# ---------------- 竞赛详情 ----------------

@bp.route('/<int:cid>')
def detail(cid):
    comp = qone('''SELECT c.*, u.username AS publisher_name, u.role AS publisher_role
                   FROM competitions c JOIN users u ON u.id=c.publisher_id WHERE c.id=?''', (cid,))
    if comp is None:
        abort(404)
    materials = q('SELECT * FROM comp_materials WHERE competition_id=? ORDER BY id', (cid,))
    announcements = q('SELECT * FROM comp_announcements WHERE competition_id=? ORDER BY id DESC', (cid,))
    questions = q('SELECT * FROM comp_questions WHERE competition_id=? ORDER BY qno', (cid,))
    teams = q('''SELECT t.*, (SELECT COUNT(*) FROM team_members m WHERE m.team_id=t.id) AS member_count,
                        u.username AS leader_name
                 FROM teams t JOIN users u ON u.id=t.leader_id WHERE t.competition_id=? ORDER BY t.id''', (cid,))
    signup_count = qone('SELECT COUNT(*) c FROM comp_signups WHERE competition_id=?', (cid,))['c']
    my_team = None
    mine = None
    if g.get('user'):
        mine = my_signup(cid, g.user['id'])
        if mine and mine['team_id']:
            my_team = qone('SELECT * FROM teams WHERE id=?', (mine['team_id'],))

    # 实时榜单：自动评测在开放/待结算时实时判分展示
    board = []
    if comp['status'] in ('open', 'ended', 'settled'):
        if comp['eval_mode'] == 'auto' and comp['status'] in ('open', 'ended'):
            services.grade_auto(comp)
        board = leaderboard(comp)

    champion = None
    if comp['champion_user_id']:
        champion = qone('SELECT * FROM users WHERE id=?', (comp['champion_user_id'],))
    champion_team = None
    if comp['champion_team_id']:
        champion_team = qone('SELECT * FROM teams WHERE id=?', (comp['champion_team_id'],))

    can_signup = (comp['status'] == 'open' and g.get('user')
                  and g.user['id'] != comp['publisher_id'] and mine is None
                  and (not comp['signup_end'] or services.now() <= comp['signup_end'])
                  and (not comp['participant_limit'] or signup_count < comp['participant_limit']))

    return render_template('comps/detail.html', c=comp, materials=materials, announcements=announcements,
                           questions=questions, teams=teams, signup_count=signup_count, mine=mine,
                           my_team=my_team, board=board, champion=champion, champion_team=champion_team,
                           can_signup=can_signup, phase=comp_phase(comp), STATUS=STATUS_LABELS,
                           now=services.now())


# ---------------- 报名 / 组队 ----------------

@bp.route('/<int:cid>/signup', methods=['POST'])
@login_required
def signup(cid):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None:
        abort(404)
    if comp['mode'] == 'team':
        flash('团队赛请先创建或加入一支队伍', 'warn')
        return redirect(url_for('comp.detail', cid=cid))
    if g.user['id'] == comp['publisher_id']:
        flash('发布者不可参与自己发布的竞赛', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    if comp['status'] != 'open':
        flash('竞赛当前不在报名状态', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    if comp['signup_end'] and services.now() > comp['signup_end']:
        flash('报名已截止', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    if my_signup(cid, g.user['id']):
        flash('您已报名该竞赛', 'warn')
        return redirect(url_for('comp.detail', cid=cid))
    cnt = qone('SELECT COUNT(*) c FROM comp_signups WHERE competition_id=?', (cid,))['c']
    if comp['participant_limit'] and cnt >= comp['participant_limit']:
        flash('参赛人数已达上限，报名通道已关闭', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    execute('INSERT INTO comp_signups (competition_id, user_id, team_id, created_at) VALUES (?,?,NULL,?)',
            (cid, g.user['id'], services.now()))
    flash('报名成功！可在截止时间前提交作品', 'ok')
    return redirect(url_for('comp.detail', cid=cid))


@bp.route('/<int:cid>/team/create', methods=['POST'])
@login_required
def team_create(cid):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None or comp['mode'] != 'team':
        abort(404)
    name = request.form.get('team_name', '').strip()
    if not name:
        flash('请填写队伍名称', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    if g.user['id'] == comp['publisher_id']:
        flash('发布者不可参与自己发布的竞赛', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    if comp['status'] != 'open' or (comp['signup_end'] and services.now() > comp['signup_end']):
        flash('报名已截止', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    if my_signup(cid, g.user['id']):
        flash('您已报名（已在队伍中）', 'warn')
        return redirect(url_for('comp.detail', cid=cid))
    tc = qone('SELECT COUNT(*) c FROM teams WHERE competition_id=?', (cid,))['c']
    if comp['team_count_max'] and tc >= comp['team_count_max']:
        flash('队伍数量已达上限', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    cnt = qone('SELECT COUNT(*) c FROM comp_signups WHERE competition_id=?', (cid,))['c']
    if comp['participant_limit'] and cnt >= comp['participant_limit']:
        flash('参赛总人数已达上限', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    cur = execute('INSERT INTO teams (competition_id, name, leader_id, created_at) VALUES (?,?,?,?)',
                  (cid, name, g.user['id'], services.now()))
    tid = cur.lastrowid
    execute('INSERT INTO team_members (team_id, user_id, joined_at) VALUES (?,?,?)',
            (tid, g.user['id'], services.now()))
    execute('INSERT INTO comp_signups (competition_id, user_id, team_id, created_at) VALUES (?,?,?,?)',
            (cid, g.user['id'], tid, services.now()))
    flash('队伍「%s」创建成功，您为队长，可邀请队友加入' % name, 'ok')
    return redirect(url_for('comp.detail', cid=cid))


@bp.route('/<int:cid>/team/<int:tid>/join', methods=['POST'])
@login_required
def team_join(cid, tid):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    team = qone('SELECT * FROM teams WHERE id=? AND competition_id=?', (tid, cid))
    if comp is None or team is None:
        abort(404)
    if g.user['id'] == comp['publisher_id']:
        flash('发布者不可参与自己发布的竞赛', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    if comp['status'] != 'open' or (comp['signup_end'] and services.now() > comp['signup_end']):
        flash('报名已截止', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    if my_signup(cid, g.user['id']):
        flash('您已在其他队伍中或已报名', 'warn')
        return redirect(url_for('comp.detail', cid=cid))
    mc = qone('SELECT COUNT(*) c FROM team_members WHERE team_id=?', (tid,))['c']
    if mc >= comp['team_size_max']:
        flash('该队伍人数已满', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    cnt = qone('SELECT COUNT(*) c FROM comp_signups WHERE competition_id=?', (cid,))['c']
    if comp['participant_limit'] and cnt >= comp['participant_limit']:
        flash('参赛总人数已达上限', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    execute('INSERT INTO team_members (team_id, user_id, joined_at) VALUES (?,?,?)',
            (tid, g.user['id'], services.now()))
    execute('INSERT INTO comp_signups (competition_id, user_id, team_id, created_at) VALUES (?,?,?,?)',
            (cid, g.user['id'], tid, services.now()))
    flash('已加入队伍「%s」' % team['name'], 'ok')
    return redirect(url_for('comp.detail', cid=cid))


# ---------------- 作品提交 ----------------

@bp.route('/<int:cid>/submit', methods=['GET', 'POST'])
@login_required
def submit(cid):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None:
        abort(404)
    mine = my_signup(cid, g.user['id'])
    if mine is None:
        flash('请先报名后再提交作品', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    if comp['status'] != 'open':
        flash('竞赛已截止提交', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    if comp['submit_deadline'] and services.now() > comp['submit_deadline']:
        flash('作品提交已截止', 'error')
        return redirect(url_for('comp.detail', cid=cid))

    questions = q('SELECT * FROM comp_questions WHERE competition_id=? ORDER BY qno', (cid,))
    my_subs = q('SELECT * FROM submissions WHERE competition_id=? AND user_id=? ORDER BY version DESC',
                (cid, g.user['id']))

    if request.method == 'POST':
        content = request.form.get('content', '').strip()
        answers = {}
        if comp['eval_mode'] == 'auto':
            for qq in questions:
                val = request.form.get('ans_%d' % qq['id'], '').strip()
                if val:
                    answers[str(qq['id'])] = val
        orig, stored = save_upload(request.files.get('work_file'))
        version = (my_subs[0]['version'] + 1) if my_subs else 1
        execute(
            '''INSERT INTO submissions
               (competition_id, user_id, team_id, content, answers_json, filename, stored_name,
                version, submitted_at)
               VALUES (?,?,?,?,?,?,?,?,?)''',
            (cid, g.user['id'], mine['team_id'], content, json.dumps(answers, ensure_ascii=False),
             orig, stored, version, services.now()))
        flash('第 %d 版作品提交成功（可多次提交、新版本覆盖旧版本）' % version, 'ok')
        return redirect(url_for('comp.detail', cid=cid))

    return render_template('comps/submit.html', c=comp, questions=questions, my_subs=my_subs)


# ---------------- 发布者后台 ----------------

@bp.route('/<int:cid>/manage')
@login_required
def manage(cid):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None:
        abort(404)
    if g.user['id'] != comp['publisher_id'] and g.user['role'] != 'admin':
        flash('仅发布者可进入赛事后台', 'error')
        return redirect(url_for('comp.detail', cid=cid))
    signups = q('''SELECT s.*, u.username, u.real_name, t.name AS team_name
                   FROM comp_signups s JOIN users u ON u.id=s.user_id
                   LEFT JOIN teams t ON t.id=s.team_id
                   WHERE s.competition_id=? ORDER BY s.id''', (cid,))
    submissions = q('''SELECT su.*, u.username, u.real_name, t.name AS team_name
                       FROM submissions su JOIN users u ON u.id=su.user_id
                       LEFT JOIN teams t ON t.id=su.team_id
                       WHERE su.competition_id=? ORDER BY su.submitted_at DESC''', (cid,))
    announcements = q('SELECT * FROM comp_announcements WHERE competition_id=? ORDER BY id DESC', (cid,))
    teams = q('''SELECT t.*, (SELECT COUNT(*) FROM team_members m WHERE m.team_id=t.id) AS member_count
                 FROM teams t WHERE t.competition_id=? ORDER BY t.id''', (cid,))
    questions = q('SELECT * FROM comp_questions WHERE competition_id=? ORDER BY qno', (cid,))
    return render_template('comps/manage.html', c=comp, signups=signups, submissions=submissions,
                           announcements=announcements, teams=teams, questions=questions,
                           phase=comp_phase(comp), now=services.now())


@bp.route('/<int:cid>/announce', methods=['POST'])
@login_required
def announce(cid):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None or (g.user['id'] != comp['publisher_id'] and g.user['role'] != 'admin'):
        abort(403)
    content = request.form.get('content', '').strip()
    if content:
        execute('INSERT INTO comp_announcements (competition_id, content, created_at) VALUES (?,?,?)',
                (cid, content, services.now()))
        flash('赛事公告已发布', 'ok')
    return redirect(url_for('comp.manage', cid=cid))


@bp.route('/<int:cid>/extend', methods=['POST'])
@login_required
def extend(cid):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None or (g.user['id'] != comp['publisher_id'] and g.user['role'] != 'admin'):
        abort(403)
    new_signup_end = request.form.get('signup_end', '').strip()
    new_submit_deadline = request.form.get('submit_deadline', '').strip()
    if new_signup_end:
        if comp['signup_end'] and services.now() > comp['signup_end']:
            flash('报名已截止，不可延长报名时间', 'warn')
        else:
            execute('UPDATE competitions SET signup_end=? WHERE id=?', (new_signup_end, cid))
            flash('报名截止时间已延长', 'ok')
    if new_submit_deadline:
        if comp['submit_deadline'] and services.now() > comp['submit_deadline']:
            flash('提交已截止，不可延长提交时间', 'warn')
        else:
            execute('UPDATE competitions SET submit_deadline=?, status=? WHERE id=?',
                    (new_submit_deadline, 'open', cid))
            flash('作品提交截止时间已延长', 'ok')
    return redirect(url_for('comp.manage', cid=cid))


@bp.route('/<int:cid>/score', methods=['POST'])
@login_required
def score(cid):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None or (g.user['id'] != comp['publisher_id'] and g.user['role'] != 'admin'):
        abort(403)
    if comp['eval_mode'] != 'manual':
        flash('自动评测竞赛由系统判分', 'warn')
        return redirect(url_for('comp.manage', cid=cid))
    for key, val in request.form.items():
        if key.startswith('score_') and val.strip():
            sid = int(key[6:])
            try:
                sc = round(float(val), 2)
            except ValueError:
                continue
            note = request.form.get('note_%d' % sid, '').strip()
            execute('UPDATE submissions SET score=?, review_note=? WHERE id=? AND competition_id=?',
                    (sc, note, sid, cid))
    flash('评分已保存', 'ok')
    return redirect(url_for('comp.manage', cid=cid))


@bp.route('/<int:cid>/settle', methods=['POST'])
@login_required
def settle(cid):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None or (g.user['id'] != comp['publisher_id'] and g.user['role'] != 'admin'):
        abort(403)
    ok, msg = services.settle_competition(cid)
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('comp.manage', cid=cid))


@bp.route('/<int:cid>/fail', methods=['POST'])
@login_required
def fail(cid):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None or (g.user['id'] != comp['publisher_id'] and g.user['role'] != 'admin'):
        abort(403)
    ok, msg = services.fail_competition(cid)
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('comp.manage', cid=cid))


# ---------------- 下载 ----------------

@bp.route('/<int:cid>/material/<int:mid>/download')
def download_material(cid, mid):
    m = qone('SELECT * FROM comp_materials WHERE id=? AND competition_id=?', (mid, cid))
    if m is None:
        abort(404)
    return send_from_directory(UPLOAD_DIR, m['stored_name'], as_attachment=True, download_name=m['filename'])


@bp.route('/<int:cid>/submission/<int:sid>/download')
@login_required
def download_submission(cid, sid):
    s = qone('SELECT * FROM submissions WHERE id=? AND competition_id=?', (sid, cid))
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if s is None or not s['stored_name']:
        abort(404)
    if not (g.user['id'] == comp['publisher_id'] or g.user['role'] == 'admin'
            or g.user['id'] == s['user_id']):
        abort(403)
    return send_from_directory(UPLOAD_DIR, s['stored_name'], as_attachment=True, download_name=s['filename'])
