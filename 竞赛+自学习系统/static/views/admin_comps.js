/* 竞赛管理 Vue 应用：审核/终止用动态 form POST */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;
  var COMP = window.__COMP_STATUS__;

  window.__bootVueApp({
    data: function () {
      return {
        comps: data.comps || [],
        filterStatus: data.status || '',
        urls: U,
        reviewDialog: { open: false, comp: null, action: 'approve', reason: '' },
        terminateDialog: { open: false, comp: null, reason: '' }
      };
    },
    computed: {
      filteredComps: function () {
        var s = this.filterStatus;
        return s ? this.comps.filter(function (c) { return c.status === s; }) : this.comps;
      }
    },
    methods: {
      go: function (url) { window.location.href = url; },
      money: function (n) { return '¥' + Number(n || 0).toFixed(2); },
      shortTime: function (s) { return s ? String(s).slice(5, 16).replace('T', ' ') : '—'; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      statusInfo: function (s) { return (window.__COMP_STATUS__ || {})[s] || { label: s, type: 'info' }; },
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
        window.location.href = this.urls.adminComps + q;
      },
      openReview: function (c, action) {
        this.reviewDialog.comp = c;
        this.reviewDialog.action = action;
        this.reviewDialog.reason = '';
        this.reviewDialog.open = true;
      },
      doReview: function () {
        var c = this.reviewDialog.comp;
        if (!c) return;
        this.postForm('/admin/competition/' + c.id + '/review', {
          action: this.reviewDialog.action,
          reason: this.reviewDialog.reason,
          redirect_status: this.filterStatus
        });
      },
      openTerminate: function (c) {
        this.terminateDialog.comp = c;
        this.terminateDialog.reason = '';
        this.terminateDialog.open = true;
      },
      doTerminate: function () {
        var c = this.terminateDialog.comp;
        if (!c) return;
        this.postForm('/admin/competition/' + c.id + '/terminate', {
          reason: this.terminateDialog.reason,
          redirect_status: this.filterStatus
        });
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">竞赛管理</h1>
            <div class="vue-page-sub">审核竞赛发布、强制终止进行中的赛事</div>
          </div>
        </div>

        <el-card shadow="never" class="vue-filter-bar" style="margin-bottom:16px">
          <el-select v-model="filterStatus" placeholder="全部状态" clearable size="default" style="width:200px" @change="applyFilter">
            <el-option label="全部状态" value=""></el-option>
            <el-option label="待审核" value="pending"></el-option>
            <el-option label="进行中" value="open"></el-option>
            <el-option label="待结算" value="ended"></el-option>
            <el-option label="已结算" value="settled"></el-option>
            <el-option label="已流标" value="failed"></el-option>
            <el-option label="已终止" value="terminated"></el-option>
            <el-option label="已驳回" value="rejected"></el-option>
          </el-select>
        </el-card>

        <el-card shadow="never">
          <el-empty v-if="!filteredComps.length" description="无符合条件的竞赛"></el-empty>
          <el-table v-else :data="filteredComps" size="small" style="width:100%">
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
            <el-table-column label="报名" width="80">
              <template #default="scope">{{ scope.row.signup_count }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag size="small" :type="statusInfo(scope.row.status).type">{{ statusInfo(scope.row.status).label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="160">
              <template #default="scope">{{ fullTime(scope.row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="scope">
                <el-button v-if="scope.row.status === 'pending'" size="small" type="success" @click="openReview(scope.row, 'approve')">通过</el-button>
                <el-button v-if="scope.row.status === 'pending'" size="small" type="danger" @click="openReview(scope.row, 'reject')">驳回</el-button>
                <el-button v-if="['pending','open','ended'].indexOf(scope.row.status) >= 0" size="small" type="warning" plain @click="openTerminate(scope.row)">强制终止</el-button>
                <el-button size="small" type="info" plain @click="go('/competitions/' + scope.row.id + '/manage')">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-dialog v-model="reviewDialog.open" title="审核竞赛" width="440px">
          <div v-if="reviewDialog.comp" style="margin-bottom:12px">
            <div class="muted">竞赛标题</div>
            <div style="font-weight:700">{{ reviewDialog.comp.title }}</div>
            <div class="muted" style="font-size:12px;margin-top:4px">发布者：{{ reviewDialog.comp.publisher_name }} · 奖金 {{ money(reviewDialog.comp.prize_amount) }}</div>
          </div>
          <el-input v-model="reviewDialog.reason" type="textarea" :rows="3"
                    :placeholder="reviewDialog.action === 'approve' ? '审核备注（可选）' : '请填写驳回理由，奖金将原路退回'"></el-input>
          <template #footer>
            <el-button @click="reviewDialog.open = false">取消</el-button>
            <el-button :type="reviewDialog.action === 'approve' ? 'success' : 'danger'" @click="doReview">
              {{ reviewDialog.action === 'approve' ? '确认通过' : '确认驳回' }}
            </el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="terminateDialog.open" title="强制终止竞赛" width="440px">
          <div v-if="terminateDialog.comp" style="margin-bottom:12px">
            <div class="muted">竞赛标题</div>
            <div style="font-weight:700">{{ terminateDialog.comp.title }}</div>
            <div class="muted" style="font-size:12px;margin-top:4px;color:#dc2626">终止后奖金将原路退回发布者，操作不可撤销</div>
          </div>
          <el-input v-model="terminateDialog.reason" type="textarea" :rows="3" placeholder="请填写终止理由"></el-input>
          <template #footer>
            <el-button @click="terminateDialog.open = false">取消</el-button>
            <el-button type="warning" @click="doTerminate">确认终止</el-button>
          </template>
        </el-dialog>
      </div>
    `
  });
})();
