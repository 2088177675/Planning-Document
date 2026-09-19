/* 我的好友 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        following: data.following || [],
        followers: data.followers || [],
        friends: data.friends || [],
        activeTab: 'friends',
        urls: U,
        // 全局用户搜索
        searchKey: '',
        searchResults: [],
        searching: false,
        searched: false
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      roleTag: function (r) { return r === 'teacher' ? '老师' : r === 'admin' ? '管理员' : '学生'; },
      isFollowed: function (uid) { return this.following.some(function (r) { return r.id === uid; }); },
      follow: function (uid) {
        var self = this;
        fetch(U.learnFollow(uid), { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (!res.ok) { self.$msg.error(res.msg || '操作失败'); return; }
            self.$msg.success(res.msg || (res.following ? '已关注' : '已取消关注'));
            // 重新加载页面以更新列表
            setTimeout(function () { window.location.reload(); }, 600);
          });
      },
      doSearch: function () {
        var self = this;
        var kw = this.searchKey.trim();
        if (!kw) { this.$msg.warning('请输入用户名或姓名'); return; }
        this.searching = true;
        this.searched = true;
        fetch(U.learnUsersSearch + '?q=' + encodeURIComponent(kw))
          .then(function (r) { return r.json(); })
          .then(function (res) {
            self.searching = false;
            if (!res.ok) { self.$msg.error(res.msg || '搜索失败'); self.searchResults = []; return; }
            self.searchResults = res.users || [];
          })
          .catch(function () { self.searching = false; self.$msg.error('网络异常'); });
      },
      followFromSearch: function (u) {
        var self = this;
        fetch(U.learnFollow(u.id), { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (!res.ok) { self.$msg.error(res.msg || '操作失败'); return; }
            u.is_following = res.following;
            self.$msg.success(res.msg || (res.following ? '已关注' : '已取消关注'));
          });
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">👥 我的好友 &amp; 关注</h1>
            <div class="vue-page-sub">搜索师生用户发起关注，互相关注即为双向好友</div>
          </div>
          <div>
            <el-button type="primary" @click="go(urls.learnIndex)">✨ 自学习首页</el-button>
            <el-button @click="go(urls.learnExplore)">🌐 公开广场</el-button>
          </div>
        </div>

        <el-tabs v-model="activeTab">
          <el-tab-pane :label="'互关好友 (' + friends.length + ')'" name="friends">
            <el-empty v-if="!friends.length" description="还没有互关好友，去关注感兴趣的人吧"></el-empty>
            <el-row :gutter="12" v-else>
              <el-col :xs="24" :sm="12" :md="8" v-for="f in friends" :key="f.id" style="margin-bottom:12px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnUser(f.id))">
                  <div class="vue-card-title">{{ f.real_name || f.username }}</div>
                  <div class="vue-meta">
                    <el-tag size="small" type="primary">{{ roleTag(f.role) }}</el-tag>
                    <span>关注于 {{ fullTime(f.created_at) }}</span>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane :label="'我关注 (' + following.length + ')'" name="following">
            <el-empty v-if="!following.length" description="还没有关注任何人"></el-empty>
            <el-row :gutter="12" v-else>
              <el-col :xs="24" :sm="12" :md="8" v-for="f in following" :key="f.id" style="margin-bottom:12px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnUser(f.id))">
                  <div class="vue-card-title">{{ f.real_name || f.username }}</div>
                  <div class="vue-meta">
                    <el-tag size="small" type="primary">{{ roleTag(f.role) }}</el-tag>
                    <span>关注于 {{ fullTime(f.created_at) }}</span>
                  </div>
                  <div class="vue-card-footer">
                    <span class="muted" style="font-size:12px">点击访问主页</span>
                    <el-button size="small" type="warning" plain @click.stop="follow(f.id)">取消关注</el-button>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane :label="'关注我 (' + followers.length + ')'" name="followers">
            <el-empty v-if="!followers.length" description="还没有粉丝"></el-empty>
            <el-row :gutter="12" v-else>
              <el-col :xs="24" :sm="12" :md="8" v-for="f in followers" :key="f.id" style="margin-bottom:12px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnUser(f.id))">
                  <div class="vue-card-title">{{ f.real_name || f.username }}</div>
                  <div class="vue-meta">
                    <el-tag size="small" type="primary">{{ roleTag(f.role) }}</el-tag>
                    <span>关注于 {{ fullTime(f.created_at) }}</span>
                  </div>
                  <div class="vue-card-footer">
                    <span class="muted" style="font-size:12px">点击访问主页</span>
                    <el-button v-if="!isFollowed(f.id)" size="small" type="primary" @click.stop="follow(f.id)">+ 回关</el-button>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane label="🔍 找用户" name="find">
            <div class="vue-filter-bar">
              <el-input v-model="searchKey" placeholder="输入用户名或真实姓名搜索全校师生" clearable
                style="max-width:320px" @keyup.enter="doSearch" @clear="searched=false;searchResults=[]"></el-input>
              <el-button type="primary" :loading="searching" @click="doSearch">搜索</el-button>
              <span class="muted" style="font-size:13px">最多返回 30 条，互相关注后即成为好友</span>
            </div>
            <el-empty v-if="searched && !searching && !searchResults.length" description="没有匹配的用户，换个关键词试试"></el-empty>
            <el-row :gutter="12" v-if="searchResults.length">
              <el-col :xs="24" :sm="12" :md="8" v-for="u in searchResults" :key="u.id" style="margin-bottom:12px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnUser(u.id))">
                  <div class="vue-card-title">{{ u.real_name || u.username }}</div>
                  <div class="vue-meta">
                    <el-tag size="small" :type="u.role === 'teacher' ? 'warning' : u.role === 'admin' ? 'danger' : 'info'">{{ roleTag(u.role) }}</el-tag>
                    <span>账号：{{ u.username }}</span>
                  </div>
                  <div class="vue-card-footer">
                    <span class="muted" style="font-size:12px">点击访问主页</span>
                    <el-button size="small" :type="u.is_following ? 'success' : 'primary'" plain @click.stop="followFromSearch(u)">
                      {{ u.is_following ? '已关注 ✓' : '+ 关注' }}
                    </el-button>
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
