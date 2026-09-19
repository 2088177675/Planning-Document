/* 资金监管 Vue 应用 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        txs: data.txs || [],
        summary: data.summary || {},
        urls: U,
        filterType: '',
        filterDir: ''
      };
    },
    computed: {
      filteredTxs: function () {
        var self = this;
        return this.txs.filter(function (t) {
          if (self.filterType && t.type !== self.filterType) return false;
          if (self.filterDir && t.direction !== self.filterDir) return false;
          return true;
        });
      }
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
            <h1 class="vue-page-title" style="margin:0">资金监管</h1>
            <div class="vue-page-sub">平台全部资金流水与托管余额概览</div>
          </div>
        </div>

        <el-row :gutter="12" style="margin-bottom:16px">
          <el-col :xs="12" :sm="6" v-for="card in [
            {num: money(summary.escrow), label: '托管中资金', color: '#dc2626'},
            {num: money(summary.recharge), label: '累计充值', color: '#16a34a'},
            {num: money(summary.payout), label: '累计发奖', color: '#2563eb'},
            {num: money(summary.refund), label: '累计退款', color: '#c2410c'}
          ]" :key="card.label" style="margin-bottom:12px">
            <el-card shadow="hover">
              <div :style="'font-size:22px;font-weight:800;color:' + card.color">{{ card.num }}</div>
              <div class="muted" style="font-size:13px">{{ card.label }}</div>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="never">
          <div class="vue-section-title">全部资金流水（{{ filteredTxs.length }} / {{ txs.length }}）</div>
          <div class="vue-filter-bar" style="margin-bottom:12px">
            <el-select v-model="filterType" placeholder="全部类型" clearable size="small" style="width:140px;margin-right:8px">
              <el-option label="充值" value="recharge"></el-option>
              <el-option label="托管" value="escrow"></el-option>
              <el-option label="发放" value="payout"></el-option>
              <el-option label="退款" value="refund"></el-option>
            </el-select>
            <el-select v-model="filterDir" placeholder="全部方向" clearable size="small" style="width:140px">
              <el-option label="收入" value="in"></el-option>
              <el-option label="支出" value="out"></el-option>
            </el-select>
          </div>
          <el-empty v-if="!filteredTxs.length" description="无符合条件的流水"></el-empty>
          <el-table v-else :data="filteredTxs" size="small" style="width:100%" max-height="640">
            <el-table-column label="时间" width="160">
              <template #default="scope">{{ fullTime(scope.row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="用户" prop="username" width="120"></el-table-column>
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
            <el-table-column label="说明" min-width="220">
              <template #default="scope">{{ scope.row.note }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    `
  });
})();
