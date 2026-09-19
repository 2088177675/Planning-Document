/* 公共题库 Vue 应用（只读浏览） */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        items: data.items || [],
        urls: U,
        filterSubject: '',
        keyword: ''
      };
    },
    computed: {
      filteredItems: function () {
        var self = this;
        var kw = this.keyword.trim().toLowerCase();
        return this.items.filter(function (it) {
          if (self.filterSubject && it.subject !== self.filterSubject) return false;
          if (kw) {
            var hay = (it.title + ' ' + (it.content || '') + ' ' + (it.subject || '')).toLowerCase();
            if (hay.indexOf(kw) < 0) return false;
          }
          return true;
        });
      },
      subjects: function () {
        var seen = {}, arr = [];
        this.items.forEach(function (it) {
          if (it.subject && !seen[it.subject]) { seen[it.subject] = true; arr.push(it.subject); }
        });
        return arr;
      }
    },
    methods: {
      go: function (url) { window.location.href = url; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      sourceLabel: function (t) { return t === 'competition' ? '竞赛' : '悬赏'; },
      sourceUrl: function (it) { return it.source_type === 'competition' ? '/competitions/' + it.source_id : '/bounties/' + it.source_id; }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">公共题库</h1>
            <div class="vue-page-sub">由已归档的竞赛/悬赏一键导入，可供日常出题、组卷参考复用</div>
          </div>
          <el-button type="primary" plain @click="go(urls.archive)">前往归档中心 →</el-button>
        </div>

        <el-card shadow="never" class="vue-filter-bar" style="margin-bottom:16px">
          <el-input v-model="keyword" placeholder="按标题/内容关键词搜索" clearable size="default" style="width:280px;margin-right:8px"></el-input>
          <el-select v-model="filterSubject" placeholder="全部学科" clearable size="default" style="width:200px">
            <el-option v-for="s in subjects" :key="s" :label="s" :value="s"></el-option>
          </el-select>
        </el-card>

        <el-card shadow="never">
          <el-empty v-if="!filteredItems.length" description="题库中暂无内容，可在归档中心将已结束的赛事一键导入"></el-empty>
          <el-table v-else :data="filteredItems" size="small" style="width:100%">
            <el-table-column label="ID" width="60" prop="id"></el-table-column>
            <el-table-column label="来源" width="100">
              <template #default="scope">
                <el-tag size="small" :type="scope.row.source_type === 'competition' ? 'primary' : 'success'">{{ sourceLabel(scope.row.source_type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="标题" min-width="220">
              <template #default="scope">
                <a :href="sourceUrl(scope.row)" style="color:#2563eb">{{ scope.row.title }}</a>
              </template>
            </el-table-column>
            <el-table-column label="学科" width="120" prop="subject"></el-table-column>
            <el-table-column label="导入人" prop="importer_name" width="120"></el-table-column>
            <el-table-column label="导入时间" width="160">
              <template #default="scope">{{ fullTime(scope.row.created_at) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    `
  });
})();
