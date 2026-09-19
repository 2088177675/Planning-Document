# -*- coding: utf-8 -*-
"""独立悬赏模块：悬赏广场、发布托管、解答、采纳发奖、附件下载"""
from flask import (Blueprint, request, redirect, url_for, flash, render_template, g,
                   send_from_directory, abort)
from db import q, qone, execute, UPLOAD_DIR
from auth import login_required, member_required
import services
from files import save_upload

bp = Blueprint('bounty', __name__, url_prefix='/bounties')

STATUS_LABELS = {
    'pending': '待审核', 'open': '待解决', 'resolved': '已解决',
    'expired': '已过期', 'terminated': '已下架', 'rejected': '已驳回',
}


# ---------------- 悬赏广场 ----------------

@bp.route('/')
def list_view():
    status = request.args.get('status', '')
    subject = request.args.get('subject', '').strip()
    sort = request.args.get('sort', 'new')
    sql = '''SELECT b.*, u.username AS publisher_name,
             (SELECT COUNT(*) FROM bounty_answers a WHERE a.bounty_id=b.id) AS answer_count
             FROM bounties b JOIN users u ON u.id=b.publisher_id
             WHERE b.status IN ('open','resolved','expired','terminated')'''
    args = []
    if status:
        sql += ' AND b.status=?'
        args.append(status)
    if subject:
        sql += ' AND b.subject LIKE ?'
        args.append('%' + subject + '%')
    sql += ' ORDER BY ' + {'bounty': 'b.bounty_amount DESC', 'new': 'b.created_at DESC',
                           'expire': 'b.expire_at ASC'}.get(sort, 'b.created_at DESC')
    items = q(sql, args)
    subjects = [r['subject'] for r in q("SELECT DISTINCT subject FROM bounties WHERE subject<>''")]
    return render_template('bounties/list.html', items=items, status=status, subject=subject,
                           sort=sort, subjects=subjects, STATUS=STATUS_LABELS, now=services.now())


# ---------------- 发布悬赏 ----------------

@bp.route('/publish', methods=['GET', 'POST'])
@member_required
def publish():
    if request.method == 'POST':
        f = request.form
        title = f.get('title', '').strip()
        content = f.get('content', '').strip()
        expire_at = f.get('expire_at', '').strip()
        try:
            amount = round(float(f.get('bounty_amount', '0')), 2)
        except ValueError:
            amount = 0
        if not title or not content:
            flash('请填写悬赏标题与问题内容', 'error')
            return render_template('bounties/publish.html')
        if amount <= 0:
            flash('赏金金额必须大于 0', 'error')
            return render_template('bounties/publish.html')
        if not expire_at:
            flash('请设置悬赏有效期', 'error')
            return render_template('bounties/publish.html')
        if g.user['balance'] < amount:
            flash('账户余额不足（需托管 ¥%.2f，当前余额 ¥%.2f），请先到个人中心充值'
                  % (amount, g.user['balance']), 'error')
            return render_template('bounties/publish.html')

        cur = execute(
            '''INSERT INTO bounties
               (publisher_id, title, content, subject, tags, bounty_amount, expire_at, status, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)''',
            (g.user['id'], title, content, f.get('subject', '').strip(), f.get('tags', '').strip(),
             amount, expire_at, 'pending', services.now()))
        bid = cur.lastrowid

        for i in range(3):
            fs = request.files.get('att_file_%d' % i)
            if fs and fs.filename:
                orig, stored = save_upload(fs)
                if orig:
                    execute('''INSERT INTO bounty_attachments (bounty_id, filename, stored_name, created_at)
                               VALUES (?,?,?,?)''', (bid, orig, stored, services.now()))

        services.escrow(g.user['id'], amount, 'bounty', bid, '发布悬赏，赏金托管')
        if g.user['role'] == 'admin':
            execute("UPDATE bounties SET status='open', reviewed_at=? WHERE id=?", (services.now(), bid))
            flash('官方悬赏发布成功，已自动审核上线，赏金 ¥%.2f 已托管' % amount, 'ok')
        else:
            flash('悬赏已提交，赏金 ¥%.2f 已托管冻结，等待管理员审核' % amount, 'ok')
        return redirect(url_for('bounty.detail', bid=bid))

    return render_template('bounties/publish.html')


# ---------------- 悬赏详情 ----------------

@bp.route('/<int:bid>')
def detail(bid):
    b = qone('''SELECT b.*, u.username AS publisher_name
                FROM bounties b JOIN users u ON u.id=b.publisher_id WHERE b.id=?''', (bid,))
    if b is None:
        abort(404)
    attachments = q('SELECT * FROM bounty_attachments WHERE bounty_id=? ORDER BY id', (bid,))
    answers = q('''SELECT a.*, u.username, u.real_name
                   FROM bounty_answers a JOIN users u ON u.id=a.user_id
                   WHERE a.bounty_id=? ORDER BY a.submitted_at ASC''', (bid,))
    adopted = None
    if b['adopted_answer_id']:
        adopted = qone('SELECT * FROM bounty_answers WHERE id=?', (b['adopted_answer_id'],))
    my_answer = None
    if g.get('user'):
        my_answer = qone('SELECT * FROM bounty_answers WHERE bounty_id=? AND user_id=?',
                         (bid, g.user['id']))
    can_answer = (b['status'] == 'open' and g.get('user')
                  and g.user['id'] != b['publisher_id'] and services.now() <= b['expire_at'])
    is_publisher = g.get('user') and g.user['id'] == b['publisher_id']
    return render_template('bounties/detail.html', b=b, attachments=attachments, answers=answers,
                           adopted=adopted, my_answer=my_answer, can_answer=can_answer,
                           is_publisher=is_publisher, STATUS=STATUS_LABELS, now=services.now())


# ---------------- 提交解答 ----------------

@bp.route('/<int:bid>/answer', methods=['POST'])
@login_required
def answer(bid):
    b = qone('SELECT * FROM bounties WHERE id=?', (bid,))
    if b is None:
        abort(404)
    if g.user['id'] == b['publisher_id']:
        flash('发布者不可解答自己发布的悬赏', 'error')
        return redirect(url_for('bounty.detail', bid=bid))
    if b['status'] != 'open':
        flash('该悬赏当前不可提交解答', 'error')
        return redirect(url_for('bounty.detail', bid=bid))
    if services.now() > b['expire_at']:
        flash('悬赏已过期', 'error')
        return redirect(url_for('bounty.detail', bid=bid))
    content = request.form.get('content', '').strip()
    if not content:
        flash('请填写解答内容', 'error')
        return redirect(url_for('bounty.detail', bid=bid))
    orig, stored = save_upload(request.files.get('answer_file'))
    existing = qone('SELECT * FROM bounty_answers WHERE bounty_id=? AND user_id=?', (bid, g.user['id']))
    if existing:
        execute('UPDATE bounty_answers SET content=?, filename=?, stored_name=?, submitted_at=? WHERE id=?',
                (content, orig or existing['filename'], stored or existing['stored_name'],
                 services.now(), existing['id']))
        flash('解答已更新', 'ok')
    else:
        execute('''INSERT INTO bounty_answers (bounty_id, user_id, content, filename, stored_name,
                                               status, submitted_at)
                   VALUES (?,?,?,?,?, 'pending', ?)''',
                (bid, g.user['id'], content, orig, stored, services.now()))
        flash('解答提交成功，等待发布者采纳', 'ok')
    return redirect(url_for('bounty.detail', bid=bid))


# ---------------- 采纳解答 ----------------

@bp.route('/<int:bid>/adopt/<int:aid>', methods=['POST'])
@login_required
def adopt(bid, aid):
    ok, msg = services.adopt_answer(bid, aid, g.user['id'])
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('bounty.detail', bid=bid))


# ---------------- 附件下载 ----------------

@bp.route('/<int:bid>/attachment/<int:aid>/download')
def download_attachment(bid, aid):
    a = qone('SELECT * FROM bounty_attachments WHERE id=? AND bounty_id=?', (aid, bid))
    if a is None:
        abort(404)
    return send_from_directory(UPLOAD_DIR, a['stored_name'], as_attachment=True, download_name=a['filename'])


@bp.route('/<int:bid>/answer-file/<int:ans_id>/download')
@login_required
def download_answer_file(bid, ans_id):
    a = qone('SELECT * FROM bounty_answers WHERE id=? AND bounty_id=?', (ans_id, bid))
    b = qone('SELECT * FROM bounties WHERE id=?', (bid,))
    if a is None or not a['stored_name']:
        abort(404)
    if not (g.user['id'] == b['publisher_id'] or g.user['role'] == 'admin'
            or g.user['id'] == a['user_id']):
        abort(403)
    return send_from_directory(UPLOAD_DIR, a['stored_name'], as_attachment=True, download_name=a['filename'])
