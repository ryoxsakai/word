// 閲覧ページ（viewer/app.js）と同じ見出し階層のアイコン。
const HIERARCHY_ICONS = {
  chapter: `<svg class="hierarchy-icon hierarchy-icon-chapter" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="hierarchy-icon-fill" d="M3.75 5.4c2.9-.92 5.65-.45 8.25 1.3v12.1c-2.6-1.75-5.35-2.22-8.25-1.3V5.4Zm16.5 0c-2.9-.92-5.65-.45-8.25 1.3v12.1c2.6-1.75 5.35-2.22 8.25-1.3V5.4Z"/><path d="M3.75 5.4c2.9-.92 5.65-.45 8.25 1.3v12.1c-2.6-1.75-5.35-2.22-8.25-1.3V5.4Zm16.5 0c-2.9-.92-5.65-.45-8.25 1.3v12.1c2.6-1.75 5.35-2.22 8.25-1.3V5.4ZM12 6.7v12.1"/></svg>`,
  group: `<svg class="hierarchy-icon hierarchy-icon-group" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="hierarchy-icon-fill" d="m12 3.4 9 4.5-9 4.5-9-4.5 9-4.5Z"/><path d="m3 7.9 9-4.5 9 4.5-9 4.5-9-4.5Zm0 4.1 9 4.5 9-4.5M3 16.1l9 4.5 9-4.5"/></svg>`,
  section: `<svg class="hierarchy-icon hierarchy-icon-section" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="hierarchy-icon-fill" d="M6.5 3.5h11v17L12 17.2l-5.5 3.3v-17Z"/><path d="M6.5 3.5h11v17L12 17.2l-5.5 3.3v-17Z"/></svg>`,
  label: `<svg class="hierarchy-icon hierarchy-icon-label" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="hierarchy-icon-fill" d="M12.7 3.5H5.3c-1 0-1.8.8-1.8 1.8v7.4l7.8 7.8 9.2-9.2-7.8-7.8Z"/><path d="M12.7 3.5H5.3c-1 0-1.8.8-1.8 1.8v7.4l7.8 7.8 9.2-9.2-7.8-7.8Z"/><circle cx="8" cy="8" r="1.15"/></svg>`,
};
export const hierarchyIcon = kind => HIERARCHY_ICONS[kind] || "";
