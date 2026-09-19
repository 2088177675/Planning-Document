/* 个人资料库 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        items: data.items || [],
        folders: data.folders || [],
        favs: data.favs || [],
        folderId: data.folderId || '',
        kind: data.kind || '',
        keyword: data.keyword || '',
        kindLabels: data.kindLabels || {},
        difficultyLabels: data.difficultyLabels || {},
        quota: data.quota || { daily_limit: 30, used_today: 0 },
        user: window.__USER__,
        urls: U,
        activeTab: 'my',
        // 新建文件夹
        newFolderName: '',
        creatingFolder: false,
        // 删除
        deletingId: null
      };
    },
    computed: {
      remaining: function () { return Math.max(0, this.quota.daily_limit - this.quota.used_today); }
    },
    methods: {
      go: function (url) { window.location.href = url; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      kindTag: function (k) { return this.kindLabels[k] || k; },
      diffTag: function (d) { return this.difficultyLabels[d] || d; },
      search: function () {
        var qs = new URLSearchParams();
        if (this.keyword) qs.set('q', this.keyword);
        if (this.kind) qs.set('kind', this.kind);
        if (this.folderId) qs.set('folder', this.folderId);
        window.location.href = U.learnLibrary + '?' + qs.toString();
      },
      createFolder: function () {
        var self = this;
        if (!this.newFolderName.trim()) { this.$msg.warning('请输入文件夹名称'); return; }
        this.creatingFolder = true;
        fetch(U.learnFolderCreate, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: this.newFolderName })
        }).then(function (r) { return r.json(); }).then(function (res) {
          self.creatingFolder = false;
          if (!res.ok) { self.$msg.error(res.msg || '创建失败'); return; }
          self.folders.push({ id: res.id, name: res.name });
          self.newFolderName = '';
          self.$msg.success('文件夹已创建');
        }).catch(function (e) { self.creatingFolder = false; self.$msg.error('网络异常'); });
      },
      removeMaterial: function (m) {
        var self = this;
        this.$confirm('确认删除「' + m.title + '」？删除后无法恢复。', '删除确认', {
          type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消'
        }).then(function () {
          // 表单 POST：用动态构造 form
          var f = document.createElement('form');
          f.method = 'POST'; f.action = U.learnMaterialDelete(m.id);
          document.body.appendChild(f); f.submit();
        }).catch(function () {});
      },
      togglePublic: function (m) {
        var self = this;
        fetch(U.learnMaterialTogglePublic(m.id), { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (!res.ok) { self.$msg.error(res.msg || '操作失败'); return; }
            m.is_public = res.is_public ? 1 : 0;
            self.$msg.success(res.is_public ? '已设为公开，广场可见' : '已设为私有');
          }).catch(function () { self.$msg.error('网络异常'); });
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">📚 个人资料库</h1>
            <div class="vue-page-sub">管理 AI 生成与上传的学习资料，支持文件夹归档、公开共享与删除</div>
          </div>
          <div>
            <el-button type="primary" @click="go(urls.learnIndex)">✨ 新的 AI 生成</el-button>
            <el-button @click="go(urls.learnFriends)">👥 我的好友</el-button>
            <el-button type="success" plain @click="go(urls.learnExplore)">🌐 公开广场</el-button>
          </div>
        </div>

        <el-card shadow="never" style="margin-bottom:16px">
          <div class="vue-info-list" style="display:flex;gap:18px;align-items:center;list-style:none">
            <li><span class="muted">今日 AI 剩余：</span><b>{{ remaining }} / {{ quota.daily_limit }}</b></li>
            <li><span class="muted">资料数：</span><b>{{ items.length }}</b></li>
            <li><span class="muted">收藏数：</span><b>{{ favs.length }}</b></li>
          </div>
        </el-card>

        <el-tabs v-model="activeTab">
          <el-tab-pane :label="'我的资料 (' + items.length + ')'" name="my">
            <div class="vue-filter-bar">
              <el-input v-model="keyword" placeholder="标题/内容关键词" clearable style="max-width:200px"
                @keyup.enter="search" @clear="search"></el-input>
              <el-select v-model="kind" placeholder="全部类型" clearable style="max-width:160px" @change="search">
                <el-option v-for="(lbl, k) in kindLabels" :key="k" :label="lbl" :value="k"></el-option>
              </el-select>
              <el-button type="primary" @click="search">搜索</el-button>
              <el-button @click="go(urls.learnLibrary)">重置</el-button>
              <div style="flex:1"></div>
              <el-input v-model="newFolderName" placeholder="新建文件夹名称" style="max-width:180px"></el-input>
              <el-button :loading="creatingFolder" @click="createFolder">+ 文件夹</el-button>
            </div>

            <el-empty v-if="!items.length" description="还没有资料，去 AI 生成或上传一份吧"></el-empty>
            <el-table v-else :data="items" size="small" style="width:100%">
              <el-table-column label="标题" min-width="220">
                <template #default="scope">
                  <a :href="urls.learnMaterial(scope.row.id)" style="color:#2563eb;font-weight:600">{{ scope.row.title }}</a>
                </template>
              </el-table-column>
              <el-table-column label="类型" width="130">
                <template #default="scope"><el-tag size="small" type="primary">{{ kindTag(scope.row.kind) }}</el-tag></template>
              </el-table-column>
              <el-table-column label="难度" width="100">
                <template #default="scope"><span>{{ diffTag(scope.row.difficulty) }}</span></template>
              </el-table-column>
              <el-table-column label="学科" prop="subject" width="100"></el-table-column>
              <el-table-column label="公开" width="80">
                <template #default="scope">
                  <el-tag v-if="scope.row.is_public" size="small" type="success">公开</el-tag>
                  <el-tag v-else size="small" type="info">私有</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="更新时间" width="150">
                <template #default="scope">{{ fullTime(scope.row.updated_at) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="200">
                <template #default="scope">
                  <el-button size="small" @click.stop="togglePublic(scope.row)">
                    {{ scope.row.is_public ? '设私有' : '设公开' }}
                  </el-button>
                  <el-button size="small" type="danger" @click.stop="removeMaterial(scope.row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane :label="'收藏资料 (' + favs.length + ')'" name="fav">
            <el-empty v-if="!favs.length" description="还没有收藏他人的公开资料"></el-empty>
            <el-row :gutter="12" v-else>
              <el-col :xs="24" :sm="12" :md="8" v-for="f in favs" :key="f.id" style="margin-bottom:12px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnMaterial(f.id))">
                  <div class="vue-card-title">{{ f.title }}</div>
                  <div class="vue-meta">
                    <el-tag size="small" type="primary">{{ kindTag(f.kind) }}</el-tag>
                    <span>作者：{{ f.author_name }}</span>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </el-tab-pane>
        </el-tabs>
      </div>
    `
  });
})();
