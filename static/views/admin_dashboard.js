/* 管理后台仪表盘 Vue 应用 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        stats: data.stats || {},
        recentTx: data.recentTx || [],
        urls: U
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      money: function (n) { return '¥' + Number(n || 0).toFixed(2); },
      moneyShort: function (n) { return '¥' + Number(n || 0).toFixed(0); },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      txTypeLabel: function (t) {
        var m = { recharge: '充值', escrow: '托管', payout: '发放', refund: '退款' };
        return m[t] || t;
      },
      txDirLabel: function (d) { return d === 'in' ? '收入' : '支出'; }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">管理后台 · 仪表盘</h1>
            <div class="vue-page-sub">监控会员、竞赛、悬赏、资金托管与流转全局状态</div>
          </div>
        </div>

        <el-row :gutter="12" style="margin-bottom:16px">
          <el-col :xs="12" :sm="6" :md="3" v-for="card in [
            {num: stats.users, label: '注册用户', url: urls.adminMembers, type: 'primary'},
            {num: stats.members, label: '正式会员', url: urls.adminMembers, type: 'warning'},
            {num: stats.pending_member, label: '待审会员', url: urls.adminMembers, type: 'danger'},
            {num: stats.pending_comp, label: '待审竞赛', url: urls.adminComps, type: 'danger'},
            {num: stats.pending_bounty, label: '待审悬赏', url: urls.adminBounties, type: 'danger'},
            {num: stats.open_comp, label: '进行中竞赛', url: urls.adminComps, type: 'success'},
            {num: stats.open_bounty, label: '待解决悬赏', url: urls.adminBounties, type: 'success'},
            {num: moneyShort(stats.escrow), label: '托管中资金', url: urls.adminFunds, type: 'danger'}
          ]" :key="card.label" style="margin-bottom:12px">
            <el-card shadow="hover" class="vue-item-card" @click="go(card.url)">
              <div :style="'font-size:22px;font-weight:800;color:#' + (card.type === 'danger' ? 'dc2626' : card.type === 'success' ? '16a34a' : card.type === 'warning' ? 'c2410c' : '2563eb')">{{ card.num }}</div>
              <div class="muted" style="font-size:13px">{{ card.label }}</div>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :xs="24" :md="8">
            <el-card shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">资金概况</div>
              <div class="vue-info-list"><span class="muted">平台托管总额</span><span class="vue-prize">{{ money(stats.escrow) }}</span></div>
              <div class="vue-info-list"><span class="muted">累计充值</span><span>{{ money(stats.tx_total) }}</span></div>
              <el-button type="primary" plain size="small" @click="go(urls.adminFunds)">资金监管详情 →</el-button>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="16">
            <el-card shadow="never">
              <div class="vue-section-title">最近 10 笔资金流水</div>
              <el-empty v-if="!recentTx.length" description="暂无流水"></el-empty>
              <el-table v-else :data="recentTx" size="small" style="width:100%">
                <el-table-column label="时间" width="160">
                  <template #default="scope">{{ fullTime(scope.row.created_at) }}</template>
                </el-table-column>
                <el-table-column label="用户" prop="username" width="100"></el-table-column>
                <el-table-column label="类型" width="80">
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
                <el-table-column label="说明" min-width="180">
                  <template #default="scope">{{ scope.row.note }}</template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </div>
    `
  });
})();
