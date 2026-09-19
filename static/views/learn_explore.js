/* 公开广场 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        items: data.items || [],
        keyword: data.keyword || '',
        kind: data.kind || '',
        kindLabels: data.kindLabels || {},
        urls: U
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      kindTag: function (k) { return this.kindLabels[k] || k; },
      search: function () {
        var qs = new URLSearchParams();
        if (this.keyword) qs.set('q', this.keyword);
        if (this.kind) qs.set('kind', this.kind);
        window.location.href = U.learnExplore + '?' + qs.toString();
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">🌐 公开学习资料广场</h1>
            <div class="vue-page-sub">浏览师生共享的学习资料，收藏后可加入自己的资料库</div>
          </div>
          <div>
            <el-button type="primary" @click="go(urls.learnIndex)">✨ AI 生成</el-button>
            <el-button @click="go(urls.learnLibrary)">📚 我的资料库</el-button>
          </div>
        </div>

        <div class="vue-filter-bar">
          <el-input v-model="keyword" placeholder="标题/内容/学科关键词" clearable style="max-width:240px"
            @keyup.enter="search" @clear="search"></el-input>
          <el-select v-model="kind" placeholder="全部类型" clearable style="max-width:160px" @change="search">
            <el-option v-for="(lbl, k) in kindLabels" :key="k" :label="lbl" :value="k"></el-option>
          </el-select>
          <el-button type="primary" @click="search">搜索</el-button>
        </div>

        <el-empty v-if="!items.length" description="暂无公开资料，去 AI 生成后设为公开试试"></el-empty>
        <el-row :gutter="16" v-else>
          <el-col :xs="24" :sm="12" :md="8" v-for="m in items" :key="m.id" style="margin-bottom:16px">
            <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnMaterial(m.id))">
              <div class="vue-card-title">{{ m.title }}</div>
              <div class="vue-meta">
                <el-tag size="small" type="primary">{{ kindTag(m.kind) }}</el-tag>
                <el-tag v-if="m.subject" size="small" type="info">{{ m.subject }}</el-tag>
                <span>👤 {{ m.author_real || m.author_name }}</span>
              </div>
              <div class="vue-meta">
                <span>👀 {{ m.views }} 浏览</span>
                <span>{{ fullTime(m.created_at) }}</span>
              </div>
              <div class="vue-card-footer">
                <span class="muted" style="font-size:12px">点击查看详情</span>
                <el-button size="small" type="primary" plain>查看</el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    `
  });
})();
