/* 悬赏管理 Vue 应用 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;
  var BOUNTY = window.__BOUNTY_STATUS__;

  window.__bootVueApp({
    data: function () {
      return {
        items: data.items || [],
        filterStatus: data.status || '',
        urls: U,
        reviewDialog: { open: false, item: null, action: 'approve', reason: '' },
        terminateDialog: { open: false, item: null, reason: '' }
      };
    },
    computed: {
      filteredItems: function () {
        var s = this.filterStatus;
        return s ? this.items.filter(function (b) { return b.status === s; }) : this.items;
      }
    },
    methods: {
      go: function (url) { window.location.href = url; },
      money: function (n) { return '¥' + Number(n || 0).toFixed(2); },
      shortTime: function (s) { return s ? String(s).slice(5, 16).replace('T', ' ') : '—'; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      statusInfo: function (s) { return (window.__BOUNTY_STATUS__ || {})[s] || { label: s, type: 'info' }; },
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
      applyFilter: function () {
        var q = this.filterStatus ? '?status=' + this.filterStatus : '';
        window.location.href = this.urls.adminBounties + q;
      },
      openReview: function (b, action) {
        this.reviewDialog.item = b;
        this.reviewDialog.action = action;
        this.reviewDialog.reason = '';
        this.reviewDialog.open = true;
      },
      doReview: function () {
        var b = this.reviewDialog.item;
        if (!b) return;
        this.postForm('/admin/bounty/' + b.id + '/review', {
          action: this.reviewDialog.action,
          reason: this.reviewDialog.reason,
          redirect_status: this.filterStatus
        });
      },
      openTerminate: function (b) {
        this.terminateDialog.item = b;
        this.terminateDialog.reason = '';
        this.terminateDialog.open = true;
      },
      doTerminate: function () {
        var b = this.terminateDialog.item;
        if (!b) return;
        this.postForm('/admin/bounty/' + b.id + '/terminate', {
          reason: this.terminateDialog.reason,
          redirect_status: this.filterStatus
        });
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">悬赏管理</h1>
            <div class="vue-page-sub">审核悬赏发布、强制下架进行中的悬赏</div>
          </div>
        </div>

        <el-card shadow="never" class="vue-filter-bar" style="margin-bottom:16px">
          <el-select v-model="filterStatus" placeholder="全部状态" clearable size="default" style="width:200px" @change="applyFilter">
            <el-option label="全部状态" value=""></el-option>
            <el-option label="待审核" value="pending"></el-option>
            <el-option label="待解决" value="open"></el-option>
            <el-option label="已解决" value="resolved"></el-option>
            <el-option label="已过期" value="expired"></el-option>
            <el-option label="已下架" value="terminated"></el-option>
            <el-option label="已驳回" value="rejected"></el-option>
          </el-select>
        </el-card>

        <el-card shadow="never">
          <el-empty v-if="!filteredItems.length" description="无符合条件的悬赏"></el-empty>
          <el-table v-else :data="filteredItems" size="small" style="width:100%">
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
            <el-table-column label="解答" width="80">
              <template #default="scope">{{ scope.row.answer_count }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag size="small" :type="statusInfo(scope.row.status).type">{{ statusInfo(scope.row.status).label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="截止" width="160">
              <template #default="scope">{{ fullTime(scope.row.expire_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="scope">
                <el-button v-if="scope.row.status === 'pending'" size="small" type="success" @click="openReview(scope.row, 'approve')">通过</el-button>
                <el-button v-if="scope.row.status === 'pending'" size="small" type="danger" @click="openReview(scope.row, 'reject')">驳回</el-button>
                <el-button v-if="['pending','open'].indexOf(scope.row.status) >= 0" size="small" type="warning" plain @click="openTerminate(scope.row)">强制下架</el-button>
                <el-button size="small" type="info" plain @click="go('/bounties/' + scope.row.id)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-dialog v-model="reviewDialog.open" title="审核悬赏" width="440px">
          <div v-if="reviewDialog.item" style="margin-bottom:12px">
            <div class="muted">悬赏标题</div>
            <div style="font-weight:700">{{ reviewDialog.item.title }}</div>
            <div class="muted" style="font-size:12px;margin-top:4px">发布者：{{ reviewDialog.item.publisher_name }} · 赏金 {{ money(reviewDialog.item.bounty_amount) }}</div>
          </div>
          <el-input v-model="reviewDialog.reason" type="textarea" :rows="3"
                    :placeholder="reviewDialog.action === 'approve' ? '审核备注（可选）' : '请填写驳回理由，赏金将原路退回'"></el-input>
          <template #footer>
            <el-button @click="reviewDialog.open = false">取消</el-button>
            <el-button :type="reviewDialog.action === 'approve' ? 'success' : 'danger'" @click="doReview">
              {{ reviewDialog.action === 'approve' ? '确认通过' : '确认驳回' }}
            </el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="terminateDialog.open" title="强制下架悬赏" width="440px">
          <div v-if="terminateDialog.item" style="margin-bottom:12px">
            <div class="muted">悬赏标题</div>
            <div style="font-weight:700">{{ terminateDialog.item.title }}</div>
            <div class="muted" style="font-size:12px;margin-top:4px;color:#dc2626">下架后赏金将原路退回发布者，操作不可撤销</div>
          </div>
          <el-input v-model="terminateDialog.reason" type="textarea" :rows="3" placeholder="请填写下架理由"></el-input>
          <template #footer>
            <el-button @click="terminateDialog.open = false">取消</el-button>
            <el-button type="warning" @click="doTerminate">确认下架</el-button>
          </template>
        </el-dialog>
      </div>
    `
  });
})();
