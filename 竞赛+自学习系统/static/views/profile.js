/* 个人中心 Vue 应用：el-tabs 多标签 + 充值/会员申请原生 form POST */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;
  var COMP = window.__COMP_STATUS__;
  var BOUNTY = window.__BOUNTY_STATUS__;
  var ROLE_NAMES = { student: '学生', teacher: '老师', admin: '管理员' };

  window.__bootVueApp({
    data: function () {
      return {
        u: data.u || {},
        myComps: data.myComps || [],
        myBounties: data.myBounties || [],
        mySignups: data.mySignups || [],
        myAnswers: data.myAnswers || [],
        myPending: data.myPending || null,
        txs: data.txs || [],
        user: window.__USER__,
        urls: U,
        activeTab: 'overview',
        rechargeForm: { amount: 100 },
        memberForm: { reason: '' }
      };
    },
    computed: {
      isMember: function () { return this.u.is_member || this.u.role === 'admin'; },
      roleLabel: function () { return ROLE_NAMES[this.u.role] || this.u.role; }
    },
    methods: {
      go: function (url) { window.location.href = url; },
      money: function (n) { return '¥' + Number(n || 0).toFixed(2); },
      shortTime: function (s) { return s ? String(s).slice(5, 16).replace('T', ' ') : '—'; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      compStatus: function (s) { return (window.__COMP_STATUS__ || {})[s] || { label: s, type: 'info' }; },
      bountyStatus: function (s) { return (window.__BOUNTY_STATUS__ || {})[s] || { label: s, type: 'info' }; },
      txTypeLabel: function (t) {
        var m = { recharge: '充值', escrow: '托管', payout: '获奖', refund: '退款' };
        return m[t] || t;
      },
      txDirLabel: function (d) { return d === 'in' ? '收入' : '支出'; },
      submitRecharge: function () {
        var a = parseFloat(this.rechargeForm.amount);
        if (!a || a <= 0) { this.$msg && this.$msg.warning('请输入有效金额'); return false; }
        return true;
      },
      submitMember: function () {
        if (!this.memberForm.reason.trim()) { this.$msg && this.$msg.warning('请填写申请理由'); return false; }
        return true;
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">个人中心</h1>
            <div class="vue-page-sub">{{ u.real_name || u.username }}（{{ u.username }}）· {{ roleLabel }}</div>
          </div>
          <div style="text-align:right">
            <div class="muted" style="font-size:13px">账户余额</div>
            <div style="font-size:26px;font-weight:800;color:#16a34a">{{ money(u.balance) }}</div>
          </div>
        </div>

        <el-tabs v-model="activeTab" type="card">
          <el-tab-pane label="基本信息" name="overview">
            <el-row :gutter="16">
              <el-col :xs="24" :md="12">
                <el-card shadow="never" style="margin-bottom:16px">
                  <div class="vue-section-title">账户充值（模拟支付）</div>
                  <div class="muted" style="font-size:13px;margin-bottom:10px">
                    充值仅用于演示托管流程。发布竞赛/悬赏时奖金将从余额中预缴冻结。
                  </div>
                  <form :action="urls.recharge" method="POST" @submit="submitRecharge">
                    <el-input v-model="rechargeForm.amount" name="amount" type="number" :step="0.01" :min="0.01"
                              size="large" style="margin-bottom:12px">
                      <template #prepend>¥</template>
                    </el-input>
                    <el-button type="primary" size="large" native-type="submit">立即充值</el-button>
                  </form>
                </el-card>
              </el-col>
              <el-col :xs="24" :md="12">
                <el-card shadow="never" style="margin-bottom:16px">
                  <div class="vue-section-title">会员资格</div>
                  <div v-if="isMember" style="margin-bottom:10px">
                    <el-tag type="warning" size="large">VIP 会员</el-tag>
                    <div class="muted" style="font-size:13px;margin-top:6px">您已开通会员，可发布竞赛与悬赏</div>
                  </div>
                  <div v-else-if="myPending" style="margin-bottom:10px">
                    <el-tag type="info" size="large">申请审核中</el-tag>
                    <div class="muted" style="font-size:13px;margin-top:6px">会员申请已提交，请耐心等待管理员审核</div>
                  </div>
                  <div v-else>
                    <div class="muted" style="font-size:13px;margin-bottom:10px">仅会员可发布竞赛/悬赏，请填写理由申请</div>
                    <form :action="urls.memberApply" method="POST" @submit="submitMember">
                      <el-input v-model="memberForm.reason" name="reason" type="textarea" :rows="3"
                                placeholder="请简述您的身份、专业或发布需求，便于管理员审核"></el-input>
                      <div style="margin-top:10px">
                        <el-button type="warning" native-type="submit">申请成为会员</el-button>
                      </div>
                    </form>
                  </div>
                </el-card>
              </el-col>
            </el-row>
            <el-card shadow="never">
              <div class="vue-section-title">账户信息</div>
              <div class="vue-info-list"><span class="muted">用户名</span><span>{{ u.username }}</span></div>
              <div class="vue-info-list"><span class="muted">真实姓名</span><span>{{ u.real_name || '—' }}</span></div>
              <div class="vue-info-list"><span class="muted">角色</span><span>{{ roleLabel }}</span></div>
              <div class="vue-info-list"><span class="muted">会员状态</span><span>{{ isMember ? '已开通' : '未开通' }}</span></div>
              <div class="vue-info-list"><span class="muted">注册时间</span><span>{{ fullTime(u.created_at) }}</span></div>
            </el-card>
          </el-tab-pane>

          <el-tab-pane :label="'我发布的竞赛 (' + myComps.length + ')'" name="comps">
            <el-empty v-if="!myComps.length" description="您还未发布任何竞赛"></el-empty>
            <el-row :gutter="16" v-else>
              <el-col :xs="24" :sm="12" :md="8" v-for="c in myComps" :key="c.id" style="margin-bottom:16px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.compDetail(c.id))">
                  <div class="vue-card-title"><a :href="urls.compDetail(c.id)" @click.prevent>{{ c.title }}</a></div>
                  <div class="vue-meta">
                    <el-tag size="small" :type="compStatus(c.status).type">{{ compStatus(c.status).label }}</el-tag>
                    <span>{{ c.subject || '综合' }}</span>
                  </div>
                  <div class="vue-card-footer">
                    <span class="vue-prize">{{ money(c.prize_amount) }}</span>
                    <el-button size="small" type="primary" plain @click.stop="go(urls.compManage(c.id))">进入后台</el-button>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </el-tab-pane>

          <el-tab-pane :label="'我发布的悬赏 (' + myBounties.length + ')'" name="bounties">
            <el-empty v-if="!myBounties.length" description="您还未发布任何悬赏"></el-empty>
            <el-row :gutter="16" v-else>
              <el-col :xs="24" :sm="12" :md="8" v-for="b in myBounties" :key="b.id" style="margin-bottom:16px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.bountyDetail(b.id))">
                  <div class="vue-card-title"><a :href="urls.bountyDetail(b.id)" @click.prevent>{{ b.title }}</a></div>
                  <div class="vue-meta">
                    <el-tag size="small" :type="bountyStatus(b.status).type">{{ bountyStatus(b.status).label }}</el-tag>
                    <span>⏰ {{ shortTime(b.expire_at) }} 截止</span>
                  </div>
                  <div class="vue-card-footer">
                    <span class="vue-prize">{{ money(b.bounty_amount) }}</span>
                    <el-button size="small" type="success" plain @click.stop="go(urls.bountyDetail(b.id))">查看详情</el-button>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </el-tab-pane>

          <el-tab-pane :label="'我报名的竞赛 (' + mySignups.length + ')'" name="signups">
            <el-empty v-if="!mySignups.length" description="您还未报名任何竞赛"></el-empty>
            <el-row :gutter="16" v-else>
              <el-col :xs="24" :sm="12" :md="8" v-for="c in mySignups" :key="c.id" style="margin-bottom:16px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.compDetail(c.id))">
                  <div class="vue-card-title"><a :href="urls.compDetail(c.id)" @click.prevent>{{ c.title }}</a></div>
                  <div class="vue-meta">
                    <el-tag size="small" :type="compStatus(c.status).type">{{ compStatus(c.status).label }}</el-tag>
                    <span>👤 {{ c.publisher_name || '—' }}</span>
                  </div>
                  <div class="vue-card-footer">
                    <span class="vue-prize">{{ money(c.prize_amount) }}</span>
                    <el-button size="small" type="primary" @click.stop="go(urls.compDetail(c.id))">查看详情</el-button>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </el-tab-pane>

          <el-tab-pane :label="'我的悬赏解答 (' + myAnswers.length + ')'" name="answers">
            <el-empty v-if="!myAnswers.length" description="您还未提交任何悬赏解答"></el-empty>
            <el-row :gutter="16" v-else>
              <el-col :xs="24" :sm="12" :md="8" v-for="a in myAnswers" :key="a.id" style="margin-bottom:16px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.bountyDetail(a.id))">
                  <div class="vue-card-title"><a :href="urls.bountyDetail(a.id)" @click.prevent>{{ a.title }}</a></div>
                  <div class="vue-meta">
                    <el-tag size="small" :type="a.answer_status === 'adopted' ? 'success' : 'info'">
                      {{ a.answer_status === 'adopted' ? '已采纳' : '待采纳' }}
                    </el-tag>
                    <span>提交于 {{ shortTime(a.answer_at) }}</span>
                  </div>
                  <div class="vue-card-footer">
                    <span class="vue-prize">{{ money(a.bounty_amount) }}</span>
                    <el-button size="small" type="success" plain @click.stop="go(urls.bountyDetail(a.id))">查看悬赏</el-button>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </el-tab-pane>

          <el-tab-pane :label="'资金流水 (' + txs.length + ')'" name="txs">
            <el-empty v-if="!txs.length" description="暂无资金流水记录"></el-empty>
            <el-card v-else shadow="never">
              <el-table :data="txs" size="small" style="width:100%">
                <el-table-column label="时间" width="160">
                  <template #default="scope">{{ fullTime(scope.row.created_at) }}</template>
                </el-table-column>
                <el-table-column label="类型" width="100">
                  <template #default="scope">{{ txTypeLabel(scope.row.type) }}</template>
                </el-table-column>
                <el-table-column label="方向" width="80">
                  <template #default="scope">
                    <el-tag size="small" :type="scope.row.direction === 'in' ? 'success' : 'danger'">{{ txDirLabel(scope.row.direction) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="金额" width="120">
                  <template #default="scope">
                    <span :style="scope.row.direction === 'in' ? 'color:#16a34a;font-weight:700' : 'color:#dc2626;font-weight:700'">
                      {{ scope.row.direction === 'in' ? '+' : '-' }}{{ money(scope.row.amount) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="余额" width="120">
                  <template #default="scope">{{ money(scope.row.balance_after) }}</template>
                </el-table-column>
                <el-table-column label="说明" min-width="200">
                  <template #default="scope">{{ scope.row.note }}</template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-tab-pane>
        </el-tabs>
      </div>
    `
  });
})();
