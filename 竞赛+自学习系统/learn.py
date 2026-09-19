# -*- coding: utf-8 -*-
"""自学习平台蓝图：AI 知识点生成 / 个人资料库 / 沉浸式 AI 助学 / 好友社交

权限：自学习平台全功能对学生/老师/管理员免费开放，会员体系仅用于发布竞赛/悬赏，
与本模块完全隔离。管理员额外拥有 AI 日志查看、内容监管、配额管理权限。
"""
import json
from datetime import date
from flask import (Blueprint, request, redirect, url_for, flash, render_template,
                   jsonify, g, abort)
from db import q, qone, execute
from auth import login_required, admin_required
import services
import ai_service

bp = Blueprint('learn', __name__, url_prefix='/learn')


KIND_LABELS = {
    'ai_video_script': 'AI 视频脚本',
    'ai_mindmap': 'AI 思维导图',
    'ai_doc': 'AI 学习讲义',
    'ai_summary': 'AI 知识点总结',
    'ai_quiz': 'AI 练习题',
    'uploaded_doc': '上传文档',
    'uploaded_note': '上传笔记',
    'uploaded_image': '上传图片',
}

DIFFICULTY_LABELS = {
    'easy': '入门易懂',
    'normal': '常规学习',
    'hard': '考试冲刺',
}


# ---------------- 配额 ----------------

def get_quota(user_id):
    """获取或创建用户当日配额记录；跨日重置"""
    today = date.today().isoformat()
    row = qone('SELECT * FROM user_quota WHERE user_id=?', (user_id,))
    if row is None:
        execute('''INSERT INTO user_quota (user_id, daily_limit, used_today, reset_date)
                   VALUES (?, 30, 0, ?)''', (user_id, today))
        row = qone('SELECT * FROM user_quota WHERE user_id=?', (user_id,))
    if row['reset_date'] != today:
        execute('UPDATE user_quota SET used_today=0, reset_date=? WHERE id=?', (today, row['id']))
        row = qone('SELECT * FROM user_quota WHERE id=?', (row['id'],))
    return row


def consume_quota(user_id, count=1):
    """消耗 N 次配额，返回 (ok, remaining, limit, msg)"""
    q1 = get_quota(user_id)
    if q1['used_today'] + count > q1['daily_limit']:
        return False, q1['daily_limit'] - q1['used_today'], q1['daily_limit'], '今日 AI 生成次数已达上限，明日重置或联系管理员扩容'
    execute('UPDATE user_quota SET used_today=used_today+? WHERE id=?', (count, q1['id']))
    return True, q1['daily_limit'] - q1['used_today'] - count, q1['daily_limit'], ''


def log_ai(user_id, action, prompt, result, status, cost_ms):
    execute('''INSERT INTO learn_ai_logs
               (user_id, action, prompt, result, status, cost_ms, created_at)
               VALUES (?,?,?,?,?,?,?)''',
            (user_id, action, (prompt or '')[:2000], (result or '')[:20000], status, cost_ms, services.now()))


# ---------------- 首页 ----------------

@bp.route('/')
def index():
    u = g.get('user')
    my_recent = []
    public_hot = []
    if u:
        my_recent = q('''SELECT * FROM learn_materials WHERE user_id=? ORDER BY id DESC LIMIT 6''', (u['id'],))
    public_hot = q('''SELECT m.*, u.username AS author_name, u.real_name AS author_real
                      FROM learn_materials m JOIN users u ON u.id=m.user_id
                      WHERE m.is_public=1 ORDER BY m.views DESC, m.id DESC LIMIT 6''')
    return render_template('learn/index.html', my_recent=my_recent, public_hot=public_hot,
                           KIND_LABELS=KIND_LABELS, DIFFICULTY_LABELS=DIFFICULTY_LABELS)


# ---------------- AI 生成 ----------------

@bp.route('/ai/generate', methods=['POST'])
@login_required
def ai_generate():
    """AJAX：调用通义千问生成学习资料。返回 JSON"""
    data = request.get_json(silent=True) or request.form
    prompt = (data.get('prompt') or '').strip()
    kind = (data.get('kind') or 'auto').strip()
    subject = (data.get('subject') or '').strip()
    difficulty = (data.get('difficulty') or 'normal').strip()
    if not prompt:
        return jsonify(ok=False, msg='请输入知识点提示词'), 400
    if difficulty not in DIFFICULTY_LABELS:
        difficulty = 'normal'

    # 自动决定类型：小知识点 -> 视频脚本；体系化 -> 思维导图
    if kind == 'auto':
        kind = ai_service.auto_decide_kind(prompt)
        kind = 'ai_video_script' if kind == 'small' else 'ai_mindmap'
    if kind not in ai_service.PROMPT_TEMPLATES:
        return jsonify(ok=False, msg='未知生成类型'), 400

    ok, remaining, limit, msg = consume_quota(g.user['id'])
    if not ok:
        return jsonify(ok=False, msg=msg, remaining=remaining, limit=limit), 403

    content, cost, err = ai_service.generate_material(prompt, kind, subject, difficulty)
    if err:
        log_ai(g.user['id'], 'generate:' + kind, prompt, err, 'failed', cost)
        return jsonify(ok=False, msg='AI 调用失败：' + err, remaining=remaining, limit=limit), 500
    log_ai(g.user['id'], 'generate:' + kind, prompt, content, 'success', cost)
    return jsonify(ok=True, kind=kind, content=content,
                   remaining=remaining, limit=limit,
                   kind_label=KIND_LABELS.get(kind, kind))


# ---------------- 个人资料库 ----------------

@bp.route('/library')
@login_required
def library():
    u = g.user
    folder_id = request.args.get('folder', '')
    kind = request.args.get('kind', '')
    keyword = request.args.get('q', '').strip()
    sql = 'SELECT * FROM learn_materials WHERE user_id=?'
    args = [u['id']]
    if folder_id:
        sql += ' AND folder_id=?'
        args.append(int(folder_id) if folder_id.isdigit() else None)
    if kind:
        sql += ' AND kind=?'
        args.append(kind)
    if keyword:
        sql += ' AND (title LIKE ? OR content LIKE ?)'
        args += ['%' + keyword + '%', '%' + keyword + '%']
    sql += ' ORDER BY id DESC'
    items = q(sql, args)
    folders = q('SELECT * FROM learn_folders WHERE user_id=? ORDER BY id', (u['id'],))
    fav = q('''SELECT m.*, u.username AS author_name FROM user_favorites f
               JOIN learn_materials m ON m.id=f.material_id
               JOIN users u ON u.id=m.user_id
               WHERE f.user_id=? ORDER BY f.id DESC''', (u['id'],))
    quota = get_quota(u['id'])
    return render_template('learn/library.html', items=items, folders=folders, favs=fav,
                           folder_id=folder_id, kind=kind, keyword=keyword,
                           KIND_LABELS=KIND_LABELS, DIFFICULTY_LABELS=DIFFICULTY_LABELS,
                           quota=quota)


@bp.route('/material/save', methods=['POST'])
@login_required
def material_save():
    """AJAX：保存 AI 生成或上传的资料"""
    data = request.get_json(silent=True) or request.form
    title = (data.get('title') or '').strip()
    kind = (data.get('kind') or 'ai_doc').strip()
    content = data.get('content') or ''
    subject = (data.get('subject') or '').strip()
    difficulty = (data.get('difficulty') or 'normal').strip()
    folder_id = data.get('folder_id') or None
    is_public = 1 if str(data.get('is_public')) in ('1', 'true', 'True') else 0
    if not title:
        return jsonify(ok=False, msg='标题不能为空'), 400
    now = services.now()
    cur = execute('''INSERT INTO learn_materials
                    (user_id, folder_id, kind, title, content, subject, difficulty,
                     is_public, views, created_at, updated_at)
                    VALUES (?,?,?,?,?,?,?,?,0,?,?)''',
                  (g.user['id'], folder_id, kind, title, content, subject, difficulty,
                   is_public, now, now))
    mid = cur.lastrowid
    return jsonify(ok=True, id=mid, redirect=url_for('learn.material_view', mid=mid))


@bp.route('/material/<int:mid>')
def material_view(mid):
    m = qone('SELECT * FROM learn_materials WHERE id=?', (mid,))
    if m is None:
        abort(404)
    is_owner = g.get('user') and m['user_id'] == g.user['id']
    if not m['is_public'] and not is_owner and (not g.get('user') or g.user['role'] != 'admin'):
        flash('该资料为私有资料，仅作者可见', 'warn')
        return redirect(url_for('learn.index'))
    # 增加浏览数（作者本人不计）
    if g.get('user') is None or g.user['id'] != m['user_id']:
        execute('UPDATE learn_materials SET views=views+1 WHERE id=?', (mid,))
        m = qone('SELECT * FROM learn_materials WHERE id=?', (mid,))
    author = qone('SELECT id, username, real_name, role FROM users WHERE id=?', (m['user_id'],))
    conversations = q('SELECT * FROM learn_conversations WHERE material_id=? ORDER BY id', (mid,)) \
        if is_owner or g.get('user') and g.user['role'] == 'admin' else []
    is_fav = False
    is_following = False
    if g.get('user'):
        is_fav = qone('SELECT id FROM user_favorites WHERE user_id=? AND material_id=?',
                      (g.user['id'], mid)) is not None
        if g.user['id'] != m['user_id']:
            is_following = qone('SELECT id FROM user_follows WHERE follower_id=? AND followee_id=?',
                                (g.user['id'], m['user_id'])) is not None
    my_folders = q('SELECT * FROM learn_folders WHERE user_id=? ORDER BY id', (g.user['id'],)) \
        if g.get('user') else []
    return render_template('learn/material.html', m=m, author=author, is_owner=is_owner,
                           conversations=conversations, is_fav=is_fav, is_following=is_following,
                           my_folders=my_folders, KIND_LABELS=KIND_LABELS,
                           DIFFICULTY_LABELS=DIFFICULTY_LABELS)


@bp.route('/material/<int:mid>/update', methods=['POST'])
@login_required
def material_update(mid):
    m = qone('SELECT * FROM learn_materials WHERE id=?', (mid,))
    if m is None or m['user_id'] != g.user['id']:
        return jsonify(ok=False, msg='无权操作'), 403
    data = request.get_json(silent=True) or request.form
    title = (data.get('title') or m['title']).strip()
    content = data.get('content', m['content'])
    subject = data.get('subject', m['subject'])
    difficulty = data.get('difficulty', m['difficulty'])
    folder_id = data.get('folder_id', m['folder_id'])
    is_public = 1 if str(data.get('is_public', m['is_public'])) in ('1', 'true', 'True') else 0
    execute('''UPDATE learn_materials SET title=?, content=?, subject=?, difficulty=?,
               folder_id=?, is_public=?, updated_at=? WHERE id=?''',
            (title, content, subject, difficulty, folder_id or None, is_public, services.now(), mid))
    return jsonify(ok=True)


@bp.route('/material/<int:mid>/delete', methods=['POST'])
@login_required
def material_delete(mid):
    m = qone('SELECT * FROM learn_materials WHERE id=?', (mid,))
    if m is None or (m['user_id'] != g.user['id'] and g.user['role'] != 'admin'):
        flash('无权操作', 'error')
        return redirect(url_for('learn.library'))
    execute('DELETE FROM learn_materials WHERE id=?', (mid,))
    execute('DELETE FROM learn_conversations WHERE material_id=?', (mid,))
    execute('DELETE FROM user_favorites WHERE material_id=?', (mid,))
    execute('DELETE FROM learn_uploads WHERE material_id=?', (mid,))
    flash('资料已删除', 'ok')
    return redirect(url_for('learn.library'))


@bp.route('/material/<int:mid>/toggle_public', methods=['POST'])
@login_required
def material_toggle_public(mid):
    m = qone('SELECT * FROM learn_materials WHERE id=?', (mid,))
    if m is None or m['user_id'] != g.user['id']:
        return jsonify(ok=False, msg='无权操作'), 403
    new_pub = 0 if m['is_public'] else 1
    execute('UPDATE learn_materials SET is_public=?, updated_at=? WHERE id=?',
            (new_pub, services.now(), mid))
    return jsonify(ok=True, is_public=new_pub)


@bp.route('/material/<int:mid>/favorite', methods=['POST'])
@login_required
def material_favorite(mid):
    m = qone('SELECT id, user_id, is_public FROM learn_materials WHERE id=?', (mid,))
    if m is None:
        return jsonify(ok=False, msg='资料不存在'), 404
    if not m['is_public'] and m['user_id'] != g.user['id']:
        return jsonify(ok=False, msg='私有资料不可收藏'), 403
    fav = qone('SELECT id FROM user_favorites WHERE user_id=? AND material_id=?',
               (g.user['id'], mid))
    if fav:
        execute('DELETE FROM user_favorites WHERE id=?', (fav['id'],))
        return jsonify(ok=True, favorited=False)
    execute('INSERT INTO user_favorites (user_id, material_id, created_at) VALUES (?,?,?)',
            (g.user['id'], mid, services.now()))
    return jsonify(ok=True, favorited=True)


# ---------------- AI 助学对话 ----------------

@bp.route('/material/<int:mid>/assist', methods=['POST'])
@login_required
def material_assist(mid):
    """AJAX：基于当前资料上下文作答"""
    m = qone('SELECT * FROM learn_materials WHERE id=?', (mid,))
    if m is None:
        return jsonify(ok=False, msg='资料不存在'), 404
    if not m['is_public'] and m['user_id'] != g.user['id'] and g.user['role'] != 'admin':
        return jsonify(ok=False, msg='无权对该资料发起 AI 助学'), 403
    data = request.get_json(silent=True) or request.form
    question = (data.get('question') or '').strip()
    if not question:
        return jsonify(ok=False, msg='请输入问题'), 400
    history = q('SELECT role, content FROM learn_conversations WHERE material_id=? ORDER BY id LIMIT 50',
                (mid,))
    # 记录用户提问
    execute('''INSERT INTO learn_conversations (material_id, user_id, role, content, created_at)
               VALUES (?,?,?,?,?)''',
            (mid, g.user['id'], 'user', question, services.now()))
    ok, remaining, limit, msg = consume_quota(g.user['id'])
    if not ok:
        return jsonify(ok=False, msg=msg), 403
    answer, cost, err = ai_service.assist_chat(m, list(history), question)
    if err:
        log_ai(g.user['id'], 'assist', question, err, 'failed', cost)
        return jsonify(ok=False, msg='AI 调用失败：' + err), 500
    execute('''INSERT INTO learn_conversations (material_id, user_id, role, content, created_at)
               VALUES (?,?,?,?,?)''',
            (mid, g.user['id'], 'assistant', answer, services.now()))
    log_ai(g.user['id'], 'assist', question, answer, 'success', cost)
    return jsonify(ok=True, answer=answer)


@bp.route('/material/<int:mid>/conversations')
@login_required
def material_conversations(mid):
    m = qone('SELECT id, user_id FROM learn_materials WHERE id=?', (mid,))
    if m is None:
        return jsonify(ok=False, msg='资料不存在'), 404
    if m['user_id'] != g.user['id'] and g.user['role'] != 'admin':
        return jsonify(ok=False, msg='无权查看完整对话历史'), 403
    rows = q('SELECT role, content, created_at FROM learn_conversations WHERE material_id=? ORDER BY id',
             (mid,))
    return jsonify(ok=True, conversations=[dict(r) for r in rows])


# ---------------- 文件夹 ----------------

@bp.route('/folders', methods=['POST'])
@login_required
def folder_create():
    data = request.get_json(silent=True) or request.form
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify(ok=False, msg='文件夹名称不能为空'), 400
    cur = execute('INSERT INTO learn_folders (user_id, name, parent_id, created_at) VALUES (?,?,?,?)',
                  (g.user['id'], name, None, services.now()))
    return jsonify(ok=True, id=cur.lastrowid, name=name)


@bp.route('/folders/<int:fid>', methods=['POST'])
@login_required
def folder_update(fid):
    f = qone('SELECT * FROM learn_folders WHERE id=? AND user_id=?', (fid, g.user['id']))
    if f is None:
        return jsonify(ok=False, msg='文件夹不存在或无权操作'), 404
    data = request.get_json(silent=True) or request.form
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify(ok=False, msg='名称不能为空'), 400
    execute('UPDATE learn_folders SET name=? WHERE id=?', (name, fid))
    return jsonify(ok=True)


@bp.route('/folders/<int:fid>/delete', methods=['POST'])
@login_required
def folder_delete(fid):
    f = qone('SELECT * FROM learn_folders WHERE id=? AND user_id=?', (fid, g.user['id']))
    if f is None:
        return jsonify(ok=False, msg='文件夹不存在或无权操作'), 404
    execute('UPDATE learn_materials SET folder_id=NULL WHERE folder_id=?', (fid,))
    execute('DELETE FROM learn_folders WHERE id=?', (fid,))
    return jsonify(ok=True)


# ---------------- 公开广场 / 用户主页 / 社交 ----------------

@bp.route('/explore')
def explore():
    keyword = request.args.get('q', '').strip()
    kind = request.args.get('kind', '')
    sql = '''SELECT m.*, u.username AS author_name, u.real_name AS author_real
             FROM learn_materials m JOIN users u ON u.id=m.user_id
             WHERE m.is_public=1'''
    args = []
    if kind:
        sql += ' AND m.kind=?'
        args.append(kind)
    if keyword:
        sql += ' AND (m.title LIKE ? OR m.content LIKE ? OR m.subject LIKE ?)'
        args += ['%' + keyword + '%', '%' + keyword + '%', '%' + keyword + '%']
    sql += ' ORDER BY m.views DESC, m.id DESC'
    items = q(sql, args)
    return render_template('learn/explore.html', items=items, keyword=keyword, kind=kind,
                           KIND_LABELS=KIND_LABELS)


@bp.route('/user/<int:uid>')
def user_home(uid):
    u = qone('SELECT id, username, real_name, role, is_member, created_at FROM users WHERE id=?', (uid,))
    if u is None:
        abort(404)
    public_mats = q('SELECT * FROM learn_materials WHERE user_id=? AND is_public=1 ORDER BY id DESC', (uid,))
    follower_count = qone('SELECT COUNT(*) c FROM user_follows WHERE followee_id=?', (uid,))['c']
    following_count = qone('SELECT COUNT(*) c FROM user_follows WHERE follower_id=?', (uid,))['c']
    is_following = False
    if g.get('user') and g.user['id'] != uid:
        is_following = qone('SELECT id FROM user_follows WHERE follower_id=? AND followee_id=?',
                            (g.user['id'], uid)) is not None
    is_self = g.get('user') and g.user['id'] == uid
    return render_template('learn/user.html', u=u, public_mats=public_mats,
                           follower_count=follower_count, following_count=following_count,
                           is_following=is_following, is_self=is_self,
                           KIND_LABELS=KIND_LABELS)


@bp.route('/follow/<int:uid>', methods=['POST'])
@login_required
def follow(uid):
    if uid == g.user['id']:
        return jsonify(ok=False, msg='不能关注自己'), 400
    exists = qone('SELECT id FROM user_follows WHERE follower_id=? AND followee_id=?',
                  (g.user['id'], uid))
    if exists:
        execute('DELETE FROM user_follows WHERE id=?', (exists['id'],))
        return jsonify(ok=True, following=False, msg='已取消关注')
    execute('INSERT INTO user_follows (follower_id, followee_id, created_at) VALUES (?,?,?)',
            (g.user['id'], uid, services.now()))
    return jsonify(ok=True, following=True, msg='已关注')


@bp.route('/users/search')
@login_required
def users_search():
    """AJAX：按用户名/真实姓名模糊搜索全校师生，返回 JSON（含当前用户是否已关注）"""
    keyword = (request.args.get('q') or '').strip()
    if not keyword:
        return jsonify(ok=True, users=[])
    rows = q('''SELECT id, username, real_name, role, created_at FROM users
                WHERE id<>? AND (username LIKE ? OR real_name LIKE ?)
                ORDER BY role DESC, id LIMIT 30''',
             (g.user['id'], '%' + keyword + '%', '%' + keyword + '%'))
    followed = {r['followee_id'] for r in
                q('SELECT followee_id FROM user_follows WHERE follower_id=?', (g.user['id'],))}
    users = [{
        'id': r['id'],
        'username': r['username'],
        'real_name': r['real_name'],
        'role': r['role'],
        'created_at': r['created_at'],
        'is_following': r['id'] in followed,
    } for r in rows]
    return jsonify(ok=True, users=users)


@bp.route('/material/<int:mid>/report', methods=['POST'])
@login_required
def material_report(mid):
    m = qone('SELECT id FROM learn_materials WHERE id=?', (mid,))
    if m is None:
        return jsonify(ok=False, msg='资料不存在'), 404
    data = request.get_json(silent=True) or request.form
    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify(ok=False, msg='请填写举报理由'), 400
    execute('''INSERT INTO content_reports (reporter_id, material_id, reason, status, created_at)
               VALUES (?,?,?,'pending',?)''',
            (g.user['id'], mid, reason, services.now()))
    return jsonify(ok=True, msg='举报已提交，管理员将尽快处理')


# ---------------- 好友 / 关注列表 ----------------

@bp.route('/friends')
@login_required
def friends():
    u = g.user
    following = q('''SELECT u.id, u.username, u.real_name, u.role, f.created_at
                    FROM user_follows f JOIN users u ON u.id=f.followee_id
                    WHERE f.follower_id=? ORDER BY f.id DESC''', (u['id'],))
    followers = q('''SELECT u.id, u.username, u.real_name, u.role, f.created_at
                     FROM user_follows f JOIN users u ON u.id=f.follower_id
                     WHERE f.followee_id=? ORDER BY f.id DESC''', (u['id'],))
    # 互相关注 = 好友（我关注 ∩ 关注我），按 id 集合取交集
    follower_ids = {r['id'] for r in followers}
    friends = [r for r in following if r['id'] in follower_ids]
    return render_template('learn/friends.html', following=following, followers=followers,
                           friends=friends)
