# -*- coding: utf-8 -*-
"""端到端流程验证（使用 Flask 测试客户端，验证后可删除）"""
import re
from app import create_app
from db import q, qone, execute
import services

app = create_app()
app.config['SECRET_KEY'] = 'test'
client = app.test_client()

passed, failed = [], []


def check(name, cond, extra=''):
    (passed if cond else failed).append(name)
    print(('  [OK] ' if cond else '  [FAIL] ') + name + (('  -> ' + str(extra)) if extra else ''))


def login(username, password='123456'):
    return client.post('/login', data={'username': username, 'password': password},
                       follow_redirects=True)


def logout():
    client.get('/logout')


def bal(username):
    with app.app_context():
        return qone('SELECT balance FROM users WHERE username=?', (username,))['balance']


print('=== 1. 权限：非会员不可发布 ===')
login('student1')
r = client.post('/competitions/publish', data={'title': 'x', 'prize_amount': 10},
                follow_redirects=False)
check('非会员发布竞赛被拦截（跳转个人中心）', r.status_code == 302 and 'profile' in r.headers['Location'])
r = client.post('/bounties/publish', data={'title': 'x', 'content': 'y', 'bounty_amount': 10,
               'expire_at': '2099-01-01T00:00'}, follow_redirects=False)
check('非会员发布悬赏被拦截', r.status_code == 302 and 'profile' in r.headers['Location'])

print('=== 2. 会员发布自动评测竞赛（奖金托管）===')
logout(); login('teacher1')
b0 = bal('teacher1')
r = client.post('/competitions/publish', data={
    'title': '校园数据分析大赛', 'intro': '测试竞赛', 'background': '背景',
    'subject': '计算机', 'difficulty': '中等', 'audience': '全校',
    'mode': 'individual', 'participant_limit': '50',
    'signup_start': '2020-01-01T00:00', 'signup_end': '2099-12-31T23:59',
    'contest_start': '2020-01-01T00:00', 'submit_deadline': '2099-12-31T23:59',
    'result_time': '2099-12-31T23:59', 'prize_amount': '200',
    'eval_mode': 'auto', 'tie_breaker': 'earliest',
    'q_content': ['1+1=?', '2+2=?'], 'q_answer': ['2', '4'], 'q_score': ['50', '50'],
}, follow_redirects=True)
check('竞赛发布提交成功', '已托管' in r.get_data(as_text=True))
check('发布者余额扣除托管奖金 200', abs(bal('teacher1') - (b0 - 200)) < 0.01, bal('teacher1'))
with app.app_context():
    comp = qone("SELECT * FROM competitions WHERE title='校园数据分析大赛'")
    cid = comp['id']
    check('竞赛状态为待审核', comp['status'] == 'pending', comp['status'])
    qids = [r['id'] for r in q('SELECT id FROM comp_questions WHERE competition_id=? ORDER BY qno', (cid,))]
    check('客观题已保存 2 道', len(qids) == 2, qids)

print('=== 3. 管理员审核竞赛 ===')
logout(); login('admin', 'admin123')
r = client.post('/admin/competition/%d/review' % cid, data={'action': 'approve'},
                follow_redirects=True)
check('管理员审核通过', '审核通过' in r.get_data(as_text=True))
with app.app_context():
    check('竞赛状态变为 open', qone('SELECT status FROM competitions WHERE id=?', (cid,))['status'] == 'open')

print('=== 4. 普通学生免费报名并提交作品 ===')
logout(); login('student1')
r = client.post('/competitions/%d/signup' % cid, follow_redirects=True)
check('学生报名成功', '报名成功' in r.get_data(as_text=True))
r = client.post('/competitions/%d/submit' % cid, data={
    'content': '我的作答', 'ans_%d' % qids[0]: '2', 'ans_%d' % qids[1]: '5',
}, follow_redirects=True)
check('作品提交成功', '提交成功' in r.get_data(as_text=True))
# 发布者不能参与自己的竞赛
logout(); login('teacher1')
r = client.post('/competitions/%d/signup' % cid, follow_redirects=True)
check('发布者报名自己的竞赛被拒', '不可参与' in r.get_data(as_text=True))

print('=== 5. 截止后自动评测结算、冠军发奖 ===')
with app.app_context():
    execute("UPDATE competitions SET submit_deadline='2020-01-01T00:00' WHERE id=?", (cid,))
client.get('/competitions/%d' % cid)  # 触发 sweep -> ended；详情页实时判分
r = client.post('/competitions/%d/settle' % cid, follow_redirects=True)
txt = r.get_data(as_text=True)
check('自动结算发奖成功', '自动评测完成' in txt and '发放' in txt, re.findall(r'flash-ok[^>]*>([^<]+)', txt))
with app.app_context():
    comp = qone('SELECT * FROM competitions WHERE id=?', (cid,))
    check('竞赛状态 settled', comp['status'] == 'settled', comp['status'])
    check('冠军为 student1', comp['champion_user_id'] == qone("SELECT id FROM users WHERE username='student1'")['id'])
    sub = qone('SELECT * FROM submissions WHERE competition_id=? ORDER BY version DESC', (cid,))
    check('自动判分 50 分（对1错1）', sub['score'] == 50.0, sub['score'])
check('冠军 student1 收到奖金 200', abs(bal('student1') - 1200) < 0.01, bal('student1'))

print('=== 6. 悬赏全流程：发布托管 -> 审核 -> 解答 -> 采纳发奖 ===')
logout(); login('student3')
b3 = bal('student3')
r = client.post('/bounties/publish', data={
    'title': 'Python 报错求助', 'content': 'IndexError 怎么解决？',
    'subject': 'Python', 'tags': '代码调试,报错',
    'bounty_amount': '100', 'expire_at': '2099-12-31T23:59',
}, follow_redirects=True)
check('悬赏发布托管成功', '已托管' in r.get_data(as_text=True))
check('发布者余额扣除 100', abs(bal('student3') - (b3 - 100)) < 0.01, bal('student3'))
with app.app_context():
    bounty = qone("SELECT * FROM bounties WHERE title='Python 报错求助'")
    bid = bounty['id']
logout(); login('admin', 'admin123')
client.post('/admin/bounty/%d/review' % bid, data={'action': 'approve'}, follow_redirects=True)
logout(); login('student2')
r = client.post('/bounties/%d/answer' % bid, data={'content': '检查列表越界，下标从0开始。'},
                follow_redirects=True)
check('学生解答提交成功', '提交成功' in r.get_data(as_text=True))
r = client.post('/bounties/%d/answer' % bid, data={'content': '发布者不能自问自答'}, follow_redirects=True)
logout(); login('student3')
with app.app_context():
    aid = qone('SELECT id FROM bounty_answers WHERE bounty_id=?', (bid,))['id']
r = client.post('/bounties/%d/adopt/%d' % (bid, aid), follow_redirects=True)
check('发布者采纳、赏金发放', '已采纳' in r.get_data(as_text=True))
check('解答者 student2 收到赏金 100', abs(bal('student2') - 1100) < 0.01, bal('student2'))
with app.app_context():
    check('悬赏状态 resolved', qone('SELECT status FROM bounties WHERE id=?', (bid,))['status'] == 'resolved')

print('=== 7. 悬赏过期自动退款 ===')
logout(); login('teacher1')
bt = bal('teacher1')
client.post('/bounties/publish', data={
    'title': '过期悬赏测试', 'content': '无人解答', 'subject': '数学',
    'bounty_amount': '50', 'expire_at': '2020-01-01T00:00',
}, follow_redirects=True)
with app.app_context():
    eid = qone("SELECT id FROM bounties WHERE title='过期悬赏测试'")['id']
logout(); login('admin', 'admin123')
client.post('/admin/bounty/%d/review' % eid, data={'action': 'approve'}, follow_redirects=True)
client.get('/bounties/')  # 触发 sweep：过期 + 退款
with app.app_context():
    st = qone('SELECT status FROM bounties WHERE id=?', (eid,))['status']
    check('过期悬赏状态为 expired', st == 'expired', st)
check('过期赏金原路退回发布者', abs(bal('teacher1') - bt) < 0.01, bal('teacher1'))

print('=== 8. 竞赛流标退款 ===')
logout(); login('teacher1')
bf = bal('teacher1')
client.post('/competitions/publish', data={
    'title': '流标测试竞赛', 'intro': '', 'background': '', 'subject': '数学', 'difficulty': '简单',
    'audience': '', 'mode': 'individual',
    'signup_start': '2020-01-01T00:00', 'signup_end': '2020-01-02T00:00',
    'contest_start': '2020-01-01T00:00', 'submit_deadline': '2099-12-31T23:59',
    'prize_amount': '80', 'eval_mode': 'manual', 'tie_breaker': 'earliest',
}, follow_redirects=True)
with app.app_context():
    fid = qone("SELECT id FROM competitions WHERE title='流标测试竞赛'")['id']
logout(); login('admin', 'admin123')
client.post('/admin/competition/%d/review' % fid, data={'action': 'approve'}, follow_redirects=True)
with app.app_context():
    execute("UPDATE competitions SET submit_deadline='2020-01-01T00:00' WHERE id=?", (fid,))
client.get('/competitions/')  # sweep -> ended
logout(); login('teacher1')
r = client.post('/competitions/%d/fail' % fid, follow_redirects=True)
check('流标退款成功', '流标' in r.get_data(as_text=True))
check('流标奖金退回发布者', abs(bal('teacher1') - bf) < 0.01, bal('teacher1'))

print('=== 9. 会员申请与审核 ===')
logout(); login('student1')
client.post('/member/apply', data={'reason': '想发布班级竞赛'}, follow_redirects=True)
with app.app_context():
    appid = qone("SELECT id FROM member_applications WHERE user_id=(SELECT id FROM users WHERE username='student1') AND status='pending'")['id']
logout(); login('admin', 'admin123')
r = client.post('/admin/member/%d/review' % appid, data={'action': 'approve'}, follow_redirects=True)
check('会员申请审核通过', '通过' in r.get_data(as_text=True))
with app.app_context():
    check('student1 已成为会员', qone("SELECT is_member FROM users WHERE username='student1'")['is_member'] == 1)

print('=== 10. 题库复用与归档 ===')
r = client.post('/admin/archive/import', data={'source_type': 'competition', 'source_id': cid},
                follow_redirects=True)
check('归档竞赛一键导入题库', '导入公共题库' in r.get_data(as_text=True))
r = client.get('/admin/bank')
check('题库列表可见', '校园数据分析大赛' in r.get_data(as_text=True))
r = client.get('/admin/archive')
check('归档中心公开展示已结算竞赛', '校园数据分析大赛' in r.get_data(as_text=True))

print()
print('=' * 50)
print('通过 %d 项，失败 %d 项' % (len(passed), len(failed)))
if failed:
    print('失败项：', failed)
    raise SystemExit(1)
print('全部端到端流程验证通过 ✓')
