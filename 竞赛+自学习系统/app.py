# -*- coding: utf-8 -*-
"""公开竞赛 & 悬赏系统 —— Flask 应用入口

对标 Kaggle 悬赏竞赛模式：会员发布（奖金/赏金前置托管）、全员免费参与、
管理员统一审核监管、系统自动结算（发奖 / 流标退款）。
"""
import json
from flask import (Flask, Blueprint, request, redirect, url_for, flash, render_template,
                   session, g)
from markupsafe import Markup
from db import get_db, close_db, init_db, q, qone, execute
import services
from auth import bp as auth_bp, login_required
from comp import bp as comp_bp, STATUS_LABELS as COMP_STATUS
from bounty import bp as bounty_bp, STATUS_LABELS as BOUNTY_STATUS
from admin import bp as admin_bp
from learn import bp as learn_bp

main_bp = Blueprint('main', __name__)

ROLE_NAMES = {'student': '学生', 'teacher': '老师', 'admin': '管理员'}


@main_bp.route('/')
def index():
    hot_comps = q('''SELECT c.*, u.username AS publisher_name,
                     (SELECT COUNT(*) FROM comp_signups s WHERE s.competition_id=c.id) AS signup_count
                     FROM competitions c JOIN users u ON u.id=c.publisher_id
                     WHERE c.status='open' ORDER BY c.prize_amount DESC LIMIT 6''')
    hot_bounties = q('''SELECT b.*, u.username AS publisher_name,
                        (SELECT COUNT(*) FROM bounty_answers a WHERE a.bounty_id=b.id) AS answer_count
                        FROM bounties b JOIN users u ON u.id=b.publisher_id
                        WHERE b.status='open' ORDER BY b.bounty_amount DESC LIMIT 6''')
    stats = {
        'comp_total': qone('SELECT COUNT(*) c FROM competitions')['c'],
        'bounty_total': qone('SELECT COUNT(*) c FROM bounties')['c'],
        'user_total': qone('SELECT COUNT(*) c FROM users')['c'],
        'payout_total': qone("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type='payout'")['s'],
    }
    return render_template('index.html', hot_comps=hot_comps, hot_bounties=hot_bounties,
                           stats=stats, COMP_STATUS=COMP_STATUS, BOUNTY_STATUS=BOUNTY_STATUS,
                           now=services.now())


@main_bp.route('/profile')
@login_required
def profile():
    u = g.user
    my_comps = q('SELECT * FROM competitions WHERE publisher_id=? ORDER BY id DESC', (u['id'],))
    my_bounties = q('SELECT * FROM bounties WHERE publisher_id=? ORDER BY id DESC', (u['id'],))
    my_signups = q('''SELECT c.* FROM comp_signups s JOIN competitions c ON c.id=s.competition_id
                      WHERE s.user_id=? ORDER BY s.id DESC''', (u['id'],))
    my_answers = q('''SELECT b.*, a.status AS answer_status, a.submitted_at AS answer_at
                      FROM bounty_answers a JOIN bounties b ON b.id=a.bounty_id
                      WHERE a.user_id=? ORDER BY a.id DESC''', (u['id'],))
    my_pending = qone("SELECT id FROM member_applications WHERE user_id=? AND status='pending'",
                      (u['id'],))
    txs = q('SELECT * FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT 20', (u['id'],))
    return render_template('profile.html', u=u, my_comps=my_comps, my_bounties=my_bounties,
                           my_signups=my_signups, my_answers=my_answers, my_pending=my_pending,
                           txs=txs, COMP_STATUS=COMP_STATUS, BOUNTY_STATUS=BOUNTY_STATUS,
                           ROLE_NAMES=ROLE_NAMES)


@main_bp.route('/recharge', methods=['POST'])
@login_required
def recharge():
    try:
        amount = round(float(request.form.get('amount', 0)), 2)
    except ValueError:
        amount = 0
    if amount <= 0:
        flash('充值金额不正确', 'error')
    else:
        services.recharge(g.user['id'], amount)
        flash('充值成功，¥%.2f 已到账（模拟支付，仅用于演示托管流程）' % amount, 'ok')
    return redirect(url_for('main.profile'))


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'competition-bounty-system-demo-secret'
    app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024  # 上传上限 64MB

    app.teardown_appcontext(close_db)
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(comp_bp)
    app.register_blueprint(bounty_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(learn_bp)

    @app.before_request
    def before_request():
        init_db()
        uid = session.get('user_id')
        g.user = qone('SELECT * FROM users WHERE id=?', (uid,)) if uid else None
        # 每次请求执行过期扫描：悬赏过期自动退款、竞赛截止转待结算
        try:
            services.sweep()
        except Exception:
            pass

    @app.context_processor
    def inject_globals():
        return {
            'current_user': g.get('user'),
            'ROLE_NAMES': ROLE_NAMES,
            'now_str': services.now(),
        }

    # 覆盖默认 tojson：支持 sqlite3.Row 序列化（前端 Vue 应用读取数据用）
    @app.template_filter('tojson')
    def tojson_filter(value):
        def default(o):
            if hasattr(o, 'keys'):
                try:
                    return {k: o[k] for k in o.keys()}
                except Exception:
                    pass
            return str(o)
        return Markup(json.dumps(value, default=default, ensure_ascii=False))

    return app


app = create_app()

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
