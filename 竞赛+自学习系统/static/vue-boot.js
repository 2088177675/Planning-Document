/* 全局 Vue 应用挂载工具 + 通用过滤器/工具函数 */
(function () {
  'use strict';

  // 通用格式化函数（挂到 window 供各页面 Vue 模板使用）
  var Util = {
    money: function (n) {
      var v = Number(n || 0);
      return '¥' + v.toFixed(2);
    },
    moneyShort: function (n) {
      var v = Number(n || 0);
      return '¥' + v.toFixed(0);
    },
    // 截取 'YYYY-MM-DDTHH:MM' -> 'MM-DD HH:MM'
    shortTime: function (s) {
      if (!s) return '—';
      s = String(s);
      return s.length > 16 ? s.slice(5, 16) : (s.length > 5 ? s.slice(5) : s);
    },
    // 截取 'YYYY-MM-DDTHH:MM' -> 'YYYY-MM-DD HH:MM'
    fullTime: function (s) {
      if (!s) return '—';
      s = String(s);
      return s.replace('T', ' ').slice(0, 16);
    }
  };

  // 状态映射
  var COMP_STATUS = {
    pending: { label: '待审核', type: 'info' },
    open: { label: '进行中', type: 'success' },
    ended: { label: '待结算', type: 'warning' },
    settled: { label: '已结算', type: 'primary' },
    failed: { label: '已流标', type: 'info' },
    terminated: { label: '已终止', type: 'info' },
    rejected: { label: '已驳回', type: 'danger' }
  };
  var BOUNTY_STATUS = {
    pending: { label: '待审核', type: 'info' },
    open: { label: '待解决', type: 'success' },
    resolved: { label: '已解决', type: 'primary' },
    expired: { label: '已过期', type: 'info' },
    terminated: { label: '已下架', type: 'info' },
    rejected: { label: '已驳回', type: 'danger' }
  };

  function compPhase(comp, nowStr) {
    if (comp.status !== 'open') return COMP_STATUS[comp.status] || { label: comp.status, type: 'info' };
    var t = nowStr || '';
    if (comp.signup_end && t > comp.signup_end) {
      if (comp.submit_deadline && t <= comp.submit_deadline) return { label: '作答中', type: 'warning' };
      return { label: '已截止', type: 'info' };
    }
    return { label: '报名中', type: 'success' };
  }

  window.__util = Util;
  window.__COMP_STATUS__ = COMP_STATUS;
  window.__BOUNTY_STATUS__ = BOUNTY_STATUS;
  window.__compPhase = compPhase;
  console.log('[vue-boot] IIFE executed, __COMP_STATUS__ keys:', Object.keys(window.__COMP_STATUS__ || {}).join(','));

  // 全局 Markdown 渲染：marked 解析 + 自动触发 mermaid 渲染
  function renderMarkdown(text) {
    if (!text) return '';
    var html;
    try {
      html = (window.marked && window.marked.parse(text)) || '';
    } catch (e) {
      html = '<pre>' + String(text) + '</pre>';
    }
    // 转义后注入；后续 mermaid 会在 DOM 渲染后被调用
    setTimeout(function () {
      if (window.mermaid) {
        try { window.mermaid.run({ nodes: document.querySelectorAll('.learn-md-preview .language-mermaid, .learn-md-preview pre code.language-mermaid') }); }
        catch (e) {}
      }
    }, 50);
    return html;
  }
  window.__renderMarkdown = renderMarkdown;
  Util.renderMarkdown = renderMarkdown;

  if (window.mermaid) {
    try { window.mermaid.initialize({ startOnLoad: false, theme: 'default' }); } catch (e) {}
  }

  /**
   * 挂载 Vue 应用
   * @param {Object} options - Vue 应用选项（setup/data/methods/template 等）
   * @param {Object} [extra] - 额外全局属性（可选）
   */
  window.__bootVueApp = function (options, extra) {
    if (!window.Vue || !window.ElementPlus) {
      console.error('Vue 或 Element Plus 未加载，无法挂载应用');
      return;
    }
    var app = Vue.createApp(options);
    app.use(ElementPlus);
    // 把 Element Plus 的 ElMessage、ElMessageBox 挂到全局属性
    app.config.globalProperties.$msg = ElementPlus.ElMessage;
    app.config.globalProperties.$confirm = ElementPlus.ElMessageBox;
    app.config.globalProperties.$util = Util;
    app.config.globalProperties.$compStatus = COMP_STATUS;
    app.config.globalProperties.$bountyStatus = BOUNTY_STATUS;
    app.config.globalProperties.$compPhase = compPhase;
    app.config.globalProperties.$renderMarkdown = renderMarkdown;
    app.config.globalProperties.$renderMd = renderMarkdown;
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (k) {
        app.config.globalProperties[k] = extra[k];
      });
    }
    // 挂载点：#vue-app（每个页面 content block 内都放一个）
    var mount = document.getElementById('vue-app');
    if (!mount) {
      console.warn('未找到 #vue-app 挂载点');
      return;
    }
    app.mount('#vue-app');
  };
})();
