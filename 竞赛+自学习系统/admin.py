# -*- coding: utf-8 -*-
"""管理员全局管理：会员体系、竞赛审核/下架、悬赏审核/下架、资金监管、归档与题库复用"""
from flask import (Blueprint, request, redirect, url_for, flash, render_template, g)
from db import q, qone
from auth import admin_required
import services
from comp import STATUS_LABELS as COMP_STATUS
from bounty import STATUS_LABELS as BOUNTY_STATUS

bp = Blueprint('admin', __name__, url_prefix='/admin')


@bp.route('/')
@admin_required
def dashboard():
    stats = {
        'users': qone('SELECT COUNT(*) c FROM users')['c'],
        'members': qone('SELECT COUNT(*) c FROM users WHERE is_member=1')['c'],
        'pending_member': qone("SELECT COUNT(*) c FROM member_applications WHERE status='pending'")['c'],
        'pending_comp': qone("SELECT COUNT(*) c FROM competitions WHERE status='pending'")['c'],
        'pending_bounty': qone("SELECT COUNT(*) c FROM bounties WHERE status='pending'")['c'],
        'open_comp': qone("SELECT COUNT(*) c FROM competitions WHERE status IN ('open','ended')")['c'],
        'open_bounty': qone("SELECT COUNT(*) c FROM bounties WHERE status='open'")['c'],
        'escrow': services.escrow_held(),
        'tx_total': qone('SELECT COALESCE(SUM(amount),0) s FROM transactions')['s'],
    }
    recent_tx = q('''SELECT t.*, u.username FROM transactions t JOIN users u ON u.id=t.user_id
                     ORDER BY t.id DESC LIMIT 10''')
    return render_template('admin/dashboard.html', stats=stats, recent_tx=recent_tx)


# ---------------- 会员体系管理 ----------------

@bp.route('/members')
@admin_required
def members():
    pending = q('''SELECT a.*, u.username, u.real_name, u.role
                   FROM member_applications a JOIN users u ON u.id=a.user_id
                   WHERE a.status='pending' ORDER BY a.id''')
    member_list = q('''SELECT u.*,
                       (SELECT MAX(reviewed_at) FROM member_applications a
                        WHERE a.user_id=u.id AND a.status='approved') AS approved_at
                       FROM users u WHERE u.is_member=1 AND u.role<>'admin' ORDER BY u.id''')
    logs = q('''SELECT l.*, u.username FROM member_logs l JOIN users u ON u.id=l.user_id
                ORDER BY l.id DESC LIMIT 50''')
    return render_template('admin/members.html', pending=pending, member_list=member_list, logs=logs)


@bp.route('/member/<int:app_id>/review', methods=['POST'])
@admin_required
def member_review(app_id):
    action = request.form.get('action', 'approve')
    note = request.form.get('note', '').strip()
    ok, msg = services.review_member(app_id, action, g.user['id'], note)
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('admin.members'))


@bp.route('/member/<int:user_id>/revoke', methods=['POST'])
@admin_required
def member_revoke(user_id):
    note = request.form.get('note', '').strip()
    ok, msg = services.revoke_member(user_id, g.user['id'], note)
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('admin.members'))


# ---------------- 竞赛管理 ----------------

@bp.route('/competitions')
@admin_required
def competitions():
    status = request.args.get('status', '')
    sql = '''SELECT c.*, u.username AS publisher_name,
             (SELECT COUNT(*) FROM comp_signups s WHERE s.competition_id=c.id) AS signup_count
             FROM competitions c JOIN users u ON u.id=c.publisher_id'''
    args = []
    if status:
        sql += ' WHERE c.status=?'
        args.append(status)
    sql += ' ORDER BY c.id DESC'
    comps = q(sql, args)
    return render_template('admin/comps.html', comps=comps, status=status, STATUS=COMP_STATUS)


@bp.route('/competition/<int:cid>/review', methods=['POST'])
@admin_required
def comp_review(cid):
    action = request.form.get('action', 'approve')
    reason = request.form.get('reason', '').strip()
    ok, msg = services.review_competition(cid, action, reason)
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('admin.competitions', status=request.form.get('redirect_status', '')))


@bp.route('/competition/<int:cid>/terminate', methods=['POST'])
@admin_required
def comp_terminate(cid):
    reason = request.form.get('reason', '').strip()
    ok, msg = services.terminate_competition(cid, reason)
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('admin.competitions', status=request.form.get('redirect_status', '')))


# ---------------- 悬赏管理 ----------------

@bp.route('/bounties')
@admin_required
def bounties():
    status = request.args.get('status', '')
    sql = '''SELECT b.*, u.username AS publisher_name,
             (SELECT COUNT(*) FROM bounty_answers a WHERE a.bounty_id=b.id) AS answer_count
             FROM bounties b JOIN users u ON u.id=b.publisher_id'''
    args = []
    if status:
        sql += ' WHERE b.status=?'
        args.append(status)
    sql += ' ORDER BY b.id DESC'
    items = q(sql, args)
    return render_template('admin/bounties.html', items=items, status=status, STATUS=BOUNTY_STATUS)


@bp.route('/bounty/<int:bid>/review', methods=['POST'])
@admin_required
def bounty_review(bid):
    action = request.form.get('action', 'approve')
    reason = request.form.get('reason', '').strip()
    ok, msg = services.review_bounty(bid, action, reason)
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('admin.bounties', status=request.form.get('redirect_status', '')))


@bp.route('/bounty/<int:bid>/terminate', methods=['POST'])
@admin_required
def bounty_terminate(bid):
    reason = request.form.get('reason', '').strip()
    ok, msg = services.terminate_bounty(bid, reason)
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('admin.bounties', status=request.form.get('redirect_status', '')))


# ---------------- 资金监管 ----------------

@bp.route('/funds')
@admin_required
def funds():
    txs = q('''SELECT t.*, u.username FROM transactions t JOIN users u ON u.id=t.user_id
               ORDER BY t.id DESC''')
    summary = {
        'escrow': services.escrow_held(),
        'recharge': qone("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type='recharge'")['s'],
        'payout': qone("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type='payout'")['s'],
        'refund': qone("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type='refund'")['s'],
        'user_balance': qone('SELECT COALESCE(SUM(balance),0) s FROM users')['s'],
    }
    return render_template('admin/funds.html', txs=txs, summary=summary)


# ---------------- 归档与题库 ----------------

@bp.route('/archive')
def archive():
    comps = q('''SELECT c.*, u.username AS publisher_name FROM competitions c
                 JOIN users u ON u.id=c.publisher_id
                 WHERE c.status IN ('settled','failed','terminated') ORDER BY c.id DESC''')
    bounties = q('''SELECT b.*, u.username AS publisher_name FROM bounties b
                    JOIN users u ON u.id=b.publisher_id
                    WHERE b.status IN ('resolved','expired','terminated') ORDER BY b.id DESC''')
    bank_ids = [r['source_type'] + ':' + str(r['source_id'])
                for r in q('SELECT source_type, source_id FROM question_bank')]
    is_admin = g.get('user') and g.user['role'] == 'admin'
    return render_template('admin/archive.html', comps=comps, bounties=bounties,
                           bank_ids=bank_ids, is_admin=is_admin,
                           COMP_STATUS=COMP_STATUS, BOUNTY_STATUS=BOUNTY_STATUS)


@bp.route('/bank')
def bank():
    items = q('''SELECT q.*, u.username AS importer_name FROM question_bank q
                 LEFT JOIN users u ON u.id=q.imported_by ORDER BY q.id DESC''')
    return render_template('admin/bank.html', items=items)


@bp.route('/archive/import', methods=['POST'])
@admin_required
def archive_import():
    source_type = request.form.get('source_type', '')
    source_id = int(request.form.get('source_id', 0))
    ok, msg = services.import_to_bank(source_type, source_id, g.user['id'])
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('admin.archive'))


# ---------------- 自学习平台：AI 日志 / 内容监管 / 配额 ----------------

@bp.route('/learn/logs')
@admin_required
def learn_logs():
    status = request.args.get('status', '')
    sql = '''SELECT l.*, u.username FROM learn_ai_logs l JOIN users u ON u.id=l.user_id'''
    args = []
    if status:
        sql += ' WHERE l.status=?'
        args.append(status)
    sql += ' ORDER BY l.id DESC LIMIT 200'
    items = q(sql, args)
    summary = {
        'total': qone('SELECT COUNT(*) c FROM learn_ai_logs')['c'],
        'success': qone("SELECT COUNT(*) c FROM learn_ai_logs WHERE status='success'")['c'],
        'failed': qone("SELECT COUNT(*) c FROM learn_ai_logs WHERE status='failed'")['c'],
        'today': qone("SELECT COUNT(*) c FROM learn_ai_logs WHERE created_at >= date('now','localtime')")['c'],
    }
    return render_template('admin/learn_logs.html', items=items, status=status, summary=summary)


@bp.route('/learn/reports')
@admin_required
def learn_reports():
    status = request.args.get('status', 'pending')
    sql = '''SELECT r.*, m.title AS material_title, m.user_id AS material_owner,
             ru.username AS reporter_name, hu.username AS handler_name
             FROM content_reports r
             JOIN learn_materials m ON m.id=r.material_id
             JOIN users ru ON ru.id=r.reporter_id
             LEFT JOIN users hu ON hu.id=r.handler_id'''
    args = []
    if status:
        sql += ' WHERE r.status=?'
        args.append(status)
    sql += ' ORDER BY r.id DESC'
    items = q(sql, args)
    return render_template('admin/learn_reports.html', items=items, status=status)


@bp.route('/learn/report/<int:rid>/handle', methods=['POST'])
@admin_required
def learn_report_handle(rid):
    action = request.form.get('action', 'dismiss')  # dismiss=驳回 / takedown=下架资料
    note = request.form.get('note', '').strip()
    r = qone('SELECT * FROM content_reports WHERE id=?', (rid,))
    if r is None:
        flash('举报记录不存在', 'error')
        return redirect(url_for('admin.learn_reports'))
    if action == 'takedown':
        execute('UPDATE learn_materials SET is_public=0 WHERE id=?', (r['material_id'],))
        execute('''UPDATE content_reports SET status='resolved', handler_id=?, note=?, handled_at=?
                   WHERE id=?''', (g.user['id'], note or '已下架违规资料', services.now(), rid))
        flash('已下架违规资料并标记处理完成', 'ok')
    else:
        execute('''UPDATE content_reports SET status='dismissed', handler_id=?, note=?, handled_at=?
                   WHERE id=?''', (g.user['id'], note or '举报无效', services.now(), rid))
        flash('举报已驳回', 'ok')
    return redirect(url_for('admin.learn_reports', status='pending'))


@bp.route('/learn/quota')
@admin_required
def learn_quota():
    items = q('''SELECT q.*, u.username, u.real_name, u.role FROM user_quota q
                 JOIN users u ON u.id=q.user_id ORDER BY q.id''')
    return render_template('admin/learn_quota.html', items=items)


@bp.route('/learn/quota/<int:uid>/update', methods=['POST'])
@admin_required
def learn_quota_update(uid):
    daily_limit = int(request.form.get('daily_limit', 30))
    if daily_limit < 0:
        daily_limit = 0
    execute('UPDATE user_quota SET daily_limit=? WHERE user_id=?', (daily_limit, uid))
    flash('已更新用户 %d 的每日 AI 上限为 %d 次' % (uid, daily_limit), 'ok')
    return redirect(url_for('admin.learn_quota'))
