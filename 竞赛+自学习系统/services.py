# -*- coding: utf-8 -*-
"""核心业务服务：资金托管与结算、自动过期扫描、竞赛评分与结算、悬赏采纳"""
import json
from datetime import datetime
from db import q, qone, execute


def now():
    return datetime.now().strftime('%Y-%m-%dT%H:%M')


# ---------------- 资金托管与结算 ----------------

def _add_tx(user_id, tx_type, amount, direction, ref_type='', ref_id=None, note=''):
    """记一笔资金流水，并更新用户余额。direction: in=入账 out=出账"""
    user = qone('SELECT * FROM users WHERE id=?', (user_id,))
    if user is None:
        return 0.0
    delta = amount if direction == 'in' else -amount
    bal = round(user['balance'] + delta, 2)
    execute('UPDATE users SET balance=? WHERE id=?', (bal, user_id))
    execute(
        '''INSERT INTO transactions
           (user_id, type, amount, direction, ref_type, ref_id, balance_after, note, created_at)
           VALUES (?,?,?,?,?,?,?,?,?)''',
        (user_id, tx_type, round(amount, 2), direction, ref_type, ref_id, bal, note, now()))
    return bal


def recharge(user_id, amount, note='账户充值（模拟支付）'):
    return _add_tx(user_id, 'recharge', amount, 'in', note=note)


def escrow(user_id, amount, ref_type, ref_id, note):
    """发布前预缴托管：余额充足则冻结扣款，返回 True；否则 False"""
    user = qone('SELECT * FROM users WHERE id=?', (user_id,))
    if user is None or user['balance'] < amount - 1e-9:
        return False
    _add_tx(user_id, 'escrow', amount, 'out', ref_type, ref_id, note)
    return True


def payout(user_id, amount, ref_type, ref_id, note):
    """奖金/赏金发放给获奖者"""
    return _add_tx(user_id, 'payout', amount, 'in', ref_type, ref_id, note)


def refund(user_id, amount, ref_type, ref_id, note):
    """流标/过期/驳回/下架时原路退回发布者"""
    return _add_tx(user_id, 'refund', amount, 'in', ref_type, ref_id, note)


def escrow_held():
    """当前系统托管中的资金总额（待审核 + 进行中/待结算的竞赛奖金与悬赏赏金）"""
    total = 0.0
    for r in q("SELECT COALESCE(SUM(prize_amount),0) s FROM competitions WHERE status IN ('pending','open','ended')"):
        total += r['s']
    for r in q("SELECT COALESCE(SUM(bounty_amount),0) s FROM bounties WHERE status IN ('pending','open')"):
        total += r['s']
    return round(total, 2)


# ---------------- 定时扫描（每次请求前执行） ----------------

def sweep():
    """1) 悬赏到期无采纳 -> 过期并自动退款；2) 竞赛过提交截止 -> 待结算"""
    t = now()
    for b in q("SELECT * FROM bounties WHERE status='open' AND expire_at<=?", (t,)):
        execute("UPDATE bounties SET status='expired' WHERE id=?", (b['id'],))
        refund(b['publisher_id'], b['bounty_amount'], 'bounty', b['id'],
               '悬赏到期无采纳解答，赏金原路退回')
    execute("UPDATE competitions SET status='ended' WHERE status='open' AND submit_deadline<=?", (t,))


# ---------------- 竞赛自动评测 ----------------

def grade_auto(comp):
    """对自动评测竞赛的最新版本作品按标准答案判分，返回 (最新作品dict, 最早提交时间dict, 总分)"""
    cid = comp['id']
    questions = q('SELECT * FROM comp_questions WHERE competition_id=? ORDER BY qno', (cid,))
    total = sum(x['score'] for x in questions) or 100.0
    subs = q('SELECT * FROM submissions WHERE competition_id=?', (cid,))
    latest, earliest = {}, {}
    for s in subs:
        key = s['team_id'] if comp['mode'] == 'team' else s['user_id']
        if key is None:
            key = s['user_id']
        if key not in latest or s['submitted_at'] > latest[key]['submitted_at']:
            latest[key] = s
        if key not in earliest or s['submitted_at'] < earliest[key]:
            earliest[key] = s['submitted_at']
    for key, s in list(latest.items()):
        if s['answers_json']:
            try:
                ans = json.loads(s['answers_json'])
            except Exception:
                ans = {}
            got = 0.0
            for qq in questions:
                if str(ans.get(str(qq['id']), '')).strip().lower() == str(qq['answer']).strip().lower():
                    got += qq['score']
            got = round(got, 2)
            execute('UPDATE submissions SET score=? WHERE id=?', (got, s['id']))
            latest[key] = qone('SELECT * FROM submissions WHERE id=?', (s['id'],))
    return latest, earliest, total


def settle_competition(comp_id):
    """发布者确认结果 -> 系统执行奖金发放 / 流标退款。返回 (ok, message)"""
    comp = qone('SELECT * FROM competitions WHERE id=?', (comp_id,))
    if comp is None:
        return False, '竞赛不存在'
    if comp['status'] != 'ended':
        return False, '当前状态不可结算（需提交截止后）'
    cid = comp['id']

    if comp['eval_mode'] == 'auto':
        latest, earliest, total = grade_auto(comp)
        valid = [s for s in latest.values() if (s['answers_json'] or s['filename'] or s['content'])]
        if not valid:
            execute("UPDATE competitions SET status='failed' WHERE id=?", (cid,))
            refund(comp['publisher_id'], comp['prize_amount'], 'competition', cid,
                   '竞赛流标：无有效参赛作品，奖金原路退回发布者')
            return True, '流标：无有效参赛作品，托管奖金已原路退回发布者'
        key_of = lambda s: s['team_id'] if (comp['mode'] == 'team' and s['team_id']) else s['user_id']
        ranked = sorted(valid, key=lambda s: (-(s['score'] or 0), earliest.get(key_of(s), s['submitted_at'])))
        champ = ranked[0]
        execute('UPDATE competitions SET status=?, champion_user_id=?, champion_team_id=? WHERE id=?',
                ('settled', champ['user_id'], champ['team_id'], cid))
        payout(champ['user_id'], comp['prize_amount'], 'competition', cid, '竞赛冠军奖金发放')
        return True, '自动评测完成：冠军已产生，奖金 ¥%.2f 已全额发放至冠军账户' % comp['prize_amount']
    else:
        # 人工评测：取发布者打分最高的作品为冠军（同分取最早提交）
        scored = q('''SELECT * FROM submissions WHERE competition_id=? AND score IS NOT NULL
                      ORDER BY score DESC, submitted_at ASC''', (cid,))
        if not scored:
            return False, '人工评测模式：请先为参赛作品打分，再确认冠军'
        champ = scored[0]
        execute('UPDATE competitions SET status=?, champion_user_id=?, champion_team_id=? WHERE id=?',
                ('settled', champ['user_id'], champ['team_id'], cid))
        payout(champ['user_id'], comp['prize_amount'], 'competition', cid, '竞赛冠军奖金发放')
        return True, '冠军已确认，奖金 ¥%.2f 已全额发放至冠军账户' % comp['prize_amount']


def fail_competition(comp_id):
    """发布者主动判定流标（无任何有效作品）-> 退款"""
    comp = qone('SELECT * FROM competitions WHERE id=?', (comp_id,))
    if comp is None or comp['status'] != 'ended':
        return False, '当前状态不可操作'
    n = qone('SELECT COUNT(*) c FROM submissions WHERE competition_id=?', (comp_id,))['c']
    if n > 0:
        return False, '已有参赛作品，不可判定流标；请完成评分结算'
    execute("UPDATE competitions SET status='failed' WHERE id=?", (comp_id,))
    refund(comp['publisher_id'], comp['prize_amount'], 'competition', comp_id,
           '竞赛流标：无有效参赛作品，奖金原路退回发布者')
    return True, '已判定流标，托管奖金已原路退回'


# ---------------- 悬赏采纳 ----------------

def adopt_answer(bounty_id, answer_id, user_id):
    b = qone('SELECT * FROM bounties WHERE id=?', (bounty_id,))
    if b is None:
        return False, '悬赏不存在'
    if b['publisher_id'] != user_id:
        return False, '仅悬赏发布者可采纳解答'
    if b['status'] != 'open':
        return False, '悬赏当前状态不可采纳'
    ans = qone('SELECT * FROM bounty_answers WHERE id=? AND bounty_id=?', (answer_id, bounty_id))
    if ans is None:
        return False, '解答不存在'
    execute("UPDATE bounty_answers SET status='adopted' WHERE id=?", (answer_id,))
    execute("UPDATE bounties SET status='resolved', adopted_answer_id=? WHERE id=?", (answer_id, bounty_id))
    payout(ans['user_id'], b['bounty_amount'], 'bounty', bounty_id, '悬赏解答被采纳，赏金到账')
    return True, '已采纳该解答，赏金 ¥%.2f 已全额发放至解答者账户' % b['bounty_amount']


# ---------------- 管理员审核 / 下架 ----------------

def review_competition(cid, action, reason=''):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None or comp['status'] != 'pending':
        return False, '竞赛不存在或已审核'
    if action == 'approve':
        execute("UPDATE competitions SET status='open', reviewed_at=? WHERE id=?", (now(), cid))
        return True, '竞赛已审核通过并发布上线'
    else:
        execute("UPDATE competitions SET status='rejected', reject_reason=?, reviewed_at=? WHERE id=?",
                (reason, now(), cid))
        refund(comp['publisher_id'], comp['prize_amount'], 'competition', cid,
               '竞赛审核驳回，预缴奖金原路退回')
        return True, '竞赛已驳回，预缴奖金已原路退回发布者'


def terminate_competition(cid, reason=''):
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    if comp is None or comp['status'] not in ('pending', 'open', 'ended'):
        return False, '当前状态不可强制终止'
    execute("UPDATE competitions SET status='terminated', reject_reason=? WHERE id=?", (reason, cid))
    refund(comp['publisher_id'], comp['prize_amount'], 'competition', cid,
           '竞赛被管理员强制终止，预缴奖金原路退回')
    return True, '竞赛已强制终止，预缴奖金已原路退回发布者'


def review_bounty(bid, action, reason=''):
    b = qone('SELECT * FROM bounties WHERE id=?', (bid,))
    if b is None or b['status'] != 'pending':
        return False, '悬赏不存在或已审核'
    if action == 'approve':
        execute("UPDATE bounties SET status='open', reviewed_at=? WHERE id=?", (now(), bid))
        return True, '悬赏已审核通过并发布上线'
    else:
        execute("UPDATE bounties SET status='rejected', reject_reason=?, reviewed_at=? WHERE id=?",
                (reason, now(), bid))
        refund(b['publisher_id'], b['bounty_amount'], 'bounty', bid,
               '悬赏审核驳回，预缴赏金原路退回')
        return True, '悬赏已驳回，预缴赏金已原路退回发布者'


def terminate_bounty(bid, reason=''):
    b = qone('SELECT * FROM bounties WHERE id=?', (bid,))
    if b is None or b['status'] not in ('pending', 'open'):
        return False, '当前状态不可强制下架'
    execute("UPDATE bounties SET status='terminated', reject_reason=? WHERE id=?", (reason, bid))
    refund(b['publisher_id'], b['bounty_amount'], 'bounty', bid,
           '悬赏被管理员强制下架，预缴赏金原路退回')
    return True, '悬赏已强制下架，预缴赏金已原路退回发布者'


# ---------------- 会员管理 ----------------

def apply_member(user_id, reason):
    existing = qone("SELECT * FROM member_applications WHERE user_id=? AND status='pending'", (user_id,))
    if existing:
        return False, '您已有待审核的会员申请'
    execute("INSERT INTO member_applications (user_id, reason, status, created_at) VALUES (?,?, 'pending', ?)",
            (user_id, reason, now()))
    execute("INSERT INTO member_logs (user_id, action, operator_id, note, created_at) VALUES (?,?,?,?,?)",
            (user_id, 'apply', user_id, '提交会员申请：' + reason, now()))
    return True, '会员申请已提交，请等待管理员审核'


def review_member(app_id, action, reviewer_id, note=''):
    app = qone('SELECT * FROM member_applications WHERE id=?', (app_id,))
    if app is None or app['status'] != 'pending':
        return False, '申请不存在或已处理'
    uid = app['user_id']
    if action == 'approve':
        execute("UPDATE member_applications SET status='approved', reviewer_id=?, review_note=?, reviewed_at=? WHERE id=?",
                (reviewer_id, note, now(), app_id))
        execute("UPDATE users SET is_member=1 WHERE id=?", (uid,))
        execute("INSERT INTO member_logs (user_id, action, operator_id, note, created_at) VALUES (?,?,?,?,?)",
                (uid, 'approve', reviewer_id, '管理员审核通过，开通会员', now()))
        return True, '已通过申请，该用户即刻成为正式会员'
    else:
        execute("UPDATE member_applications SET status='rejected', reviewer_id=?, review_note=?, reviewed_at=? WHERE id=?",
                (reviewer_id, note, now(), app_id))
        execute("INSERT INTO member_logs (user_id, action, operator_id, note, created_at) VALUES (?,?,?,?,?)",
                (uid, 'reject', reviewer_id, '管理员驳回申请：' + note, now()))
        return True, '已驳回该会员申请'


def revoke_member(user_id, operator_id, note=''):
    u = qone('SELECT * FROM users WHERE id=?', (user_id,))
    if u is None or u['role'] == 'admin':
        return False, '不可撤销管理员的会员资格'
    if not u['is_member']:
        return False, '该用户当前不是会员'
    execute("UPDATE users SET is_member=0 WHERE id=?", (user_id,))
    execute("INSERT INTO member_logs (user_id, action, operator_id, note, created_at) VALUES (?,?,?,?,?)",
            (user_id, 'revoke', operator_id, '管理员撤销会员资格：' + note, now()))
    return True, '已撤销该用户的会员资格，发布权限即刻关闭'


# ---------------- 题库复用 ----------------

def import_to_bank(source_type, source_id, admin_id):
    exists = qone('SELECT id FROM question_bank WHERE source_type=? AND source_id=?', (source_type, source_id))
    if exists:
        return False, '该内容已在题库中'
    if source_type == 'competition':
        c = qone('SELECT * FROM competitions WHERE id=?', (source_id,))
        if c is None:
            return False, '竞赛不存在'
        title, content, subject = c['title'], c['intro'] + '\n' + c['background'], c['subject']
    else:
        b = qone('SELECT * FROM bounties WHERE id=?', (source_id,))
        if b is None:
            return False, '悬赏不存在'
        title, content, subject = b['title'], b['content'], b['subject']
    execute('''INSERT INTO question_bank (source_type, source_id, title, content, subject, imported_by, created_at)
               VALUES (?,?,?,?,?,?,?)''',
            (source_type, source_id, title, content, subject, admin_id, now()))
    return True, '已一键导入公共题库，可用于日常出题与考试组卷'
