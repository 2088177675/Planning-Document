/* 归档中心 Vue 应用：管理员可一键导入公共题库 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;
  var COMP = window.__COMP_STATUS__;
  var BOUNTY = window.__BOUNTY_STATUS__;

  window.__bootVueApp({
    data: function () {
      return {
        comps: data.comps || [],
        bounties: data.bounties || [],
        bankIds: data.bankIds || [],
        isAdmin: !!data.isAdmin,
        urls: U
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      money: function (n) { return '¥' + Number(n || 0).toFixed(2); },
      shortTime: function (s) { return s ? String(s).slice(5, 16).replace('T', ' ') : '—'; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      compStatus: function (s) { return (window.__COMP_STATUS__ || {})[s] || { label: s, type: 'info' }; },
      bountyStatus: function (s) { return (window.__BOUNTY_STATUS__ || {})[s] || { label: s, type: 'info' }; },
      inBank: function (type, id) { return this.bankIds.indexOf(type + ':' + id) >= 0; },
      postForm: function (action, fields) {
        var f = document.createElement('form');
        f.method = 'POST'; f.action = action; f.style.display = 'none';
        Object.keys(fields || {}).forEach(function (k) {
          var i = document.createElement('input');
          i.type = 'hidden'; i.name = k; i.value = fields[k];
          f.appendChild(i);
        });
        document.body.appendChild(f);
        f.submit();
      },
      importToBank: function (type, id) {
        this.postForm('/admin/archive/import', { source_type: type, source_id: id });
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">归档中心</h1>
            <div class="vue-page-sub">查看已结束的竞赛与悬赏，管理员可一键导入公共题库复用</div>
          </div>
          <el-button type="primary" plain @click="go(urls.bank)">浏览公共题库 →</el-button>
        </div>

        <el-card shadow="never" style="margin-bottom:16px">
          <div class="vue-section-title">已归档竞赛（{{ comps.length }}）</div>
          <el-empty v-if="!comps.length" description="暂无已归档竞赛"></el-empty>
          <el-table v-else :data="comps" size="small" style="width:100%">
            <el-table-column label="ID" width="60" prop="id"></el-table-column>
            <el-table-column label="标题" min-width="220">
              <template #default="scope">
                <a :href="'/competitions/' + scope.row.id" style="color:#2563eb">{{ scope.row.title }}</a>
              </template>
            </el-table-column>
            <el-table-column label="发布者" prop="publisher_name" width="120"></el-table-column>
            <el-table-column label="奖金" width="100">
              <template #default="scope">{{ money(scope.row.prize_amount) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag size="small" :type="compStatus(scope.row.status).type">{{ compStatus(scope.row.status).label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="结束时间" width="160">
              <template #default="scope">{{ fullTime(scope.row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="题库" width="140" fixed="right">
              <template #default="scope">
                <el-tag v-if="inBank('competition', scope.row.id)" size="small" type="success">已入库</el-tag>
                <el-button v-else-if="isAdmin" size="small" type="primary" plain @click="importToBank('competition', scope.row.id)">导入题库</el-button>
                <span v-else class="muted" style="font-size:12px">未入库</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="never">
          <div class="vue-section-title">已归档悬赏（{{ bounties.length }}）</div>
          <el-empty v-if="!bounties.length" description="暂无已归档悬赏"></el-empty>
          <el-table v-else :data="bounties" size="small" style="width:100%">
            <el-table-column label="ID" width="60" prop="id"></el-table-column>
            <el-table-column label="标题" min-width="220">
              <template #default="scope">
                <a :href="'/bounties/' + scope.row.id" style="color:#2563eb">{{ scope.row.title }}</a>
              </template>
            </el-table-column>
            <el-table-column label="发布者" prop="publisher_name" width="120"></el-table-column>
            <el-table-column label="赏金" width="100">
              <template #default="scope">{{ money(scope.row.bounty_amount) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag size="small" :type="bountyStatus(scope.row.status).type">{{ bountyStatus(scope.row.status).label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="结束时间" width="160">
              <template #default="scope">{{ fullTime(scope.row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="题库" width="140" fixed="right">
              <template #default="scope">
                <el-tag v-if="inBank('bounty', scope.row.id)" size="small" type="success">已入库</el-tag>
                <el-button v-else-if="isAdmin" size="small" type="primary" plain @click="importToBank('bounty', scope.row.id)">导入题库</el-button>
                <span v-else class="muted" style="font-size:12px">未入库</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    `
  });
})();
