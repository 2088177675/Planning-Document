/* 用户主页 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        u: data.u || {},
        publicMats: data.publicMats || [],
        followerCount: data.followerCount || 0,
        followingCount: data.followingCount || 0,
        isFollowing: data.isFollowing,
        isSelf: data.isSelf,
        kindLabels: data.kindLabels || {},
        isLoggedIn: data.isLoggedIn,
        urls: U
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      kindTag: function (k) { return this.kindLabels[k] || k; },
      follow: function () {
        var self = this;
        if (!this.isLoggedIn) { this.$msg.warning('请先登录'); return; }
        fetch(U.learnFollow(this.u.id), { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (!res.ok) { self.$msg.error(res.msg || '操作失败'); return; }
            self.isFollowing = res.following;
            self.followerCount += res.following ? 1 : -1;
            self.$msg.success(res.msg || (res.following ? '已关注' : '已取消关注'));
          });
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">{{ u.real_name || u.username }} 的主页</h1>
            <div class="vue-meta" style="margin-top:8px">
              <el-tag size="small" type="primary">{{ u.role === 'teacher' ? '老师' : u.role === 'admin' ? '管理员' : '学生' }}</el-tag>
              <el-tag v-if="u.is_member" size="small" type="warning">VIP 会员</el-tag>
              <span>加入时间：{{ fullTime(u.created_at) }}</span>
            </div>
          </div>
          <div v-if="!isSelf">
            <el-button :type="isFollowing ? 'success' : 'primary'" plain @click="follow">
              {{ isFollowing ? '已关注 ✓' : '+ 关注' }}
            </el-button>
          </div>
          <div v-else>
            <el-button @click="go(urls.learnLibrary)">📚 我的资料库</el-button>
          </div>
        </div>

        <el-row :gutter="12" style="margin-bottom:18px">
          <el-col :xs="12" :sm="6">
            <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnUser(u.id))">
              <div style="font-size:24px;font-weight:800;color:#2563eb">{{ publicMats.length }}</div>
              <div class="muted" style="font-size:13px">公开资料</div>
            </el-card>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-card shadow="hover">
              <div style="font-size:24px;font-weight:800;color:#16a34a">{{ followingCount }}</div>
              <div class="muted" style="font-size:13px">关注</div>
            </el-card>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-card shadow="hover">
              <div style="font-size:24px;font-weight:800;color:#f59e0b">{{ followerCount }}</div>
              <div class="muted" style="font-size:13px">粉丝</div>
            </el-card>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnFriends)">
              <div style="font-size:24px;font-weight:800;color:#dc2626">👥</div>
              <div class="muted" style="font-size:13px">我的好友</div>
            </el-card>
          </el-col>
        </el-row>

        <div class="vue-section-head">
          <h2>📘 {{ isSelf ? '我的公开资料' : '公开学习资料' }}</h2>
          <a :href="urls.learnExplore" class="muted">返回广场 →</a>
        </div>
        <el-empty v-if="!publicMats.length" description="该用户暂未公开任何学习资料"></el-empty>
        <el-row :gutter="12" v-else>
          <el-col :xs="24" :sm="12" :md="8" v-for="m in publicMats" :key="m.id" style="margin-bottom:12px">
            <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnMaterial(m.id))">
              <div class="vue-card-title">{{ m.title }}</div>
              <div class="vue-meta">
                <el-tag size="small" type="primary">{{ kindTag(m.kind) }}</el-tag>
                <el-tag v-if="m.subject" size="small" type="info">{{ m.subject }}</el-tag>
                <span>👀 {{ m.views }}</span>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    `
  });
})();
