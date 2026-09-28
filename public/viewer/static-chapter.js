import {escapeHtml,collectDerivativeCrossReferences,collectPhraseCrossReferences,addDerivativeCrossReferenceAliases,createAutoCrossRefRenderer} from '../shared/markup.js';
import {groupIdiomEntries,resolveIdiomReferences} from '../shared/idioms.js';
import {createIdiomReferenceResolver} from '../shared/idiom-references.js';
import {renderWordEntry} from './word-entry.js';
import {renderIdiomEntry} from './idiom-entry.js';
const HIERARCHY_ICONS = {
  chapter: `<svg class="hierarchy-icon hierarchy-icon-chapter" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="hierarchy-icon-fill" d="M3.75 5.4c2.9-.92 5.65-.45 8.25 1.3v12.1c-2.6-1.75-5.35-2.22-8.25-1.3V5.4Zm16.5 0c-2.9-.92-5.65-.45-8.25 1.3v12.1c2.6-1.75 5.35-2.22 8.25-1.3V5.4Z"/><path d="M3.75 5.4c2.9-.92 5.65-.45 8.25 1.3v12.1c-2.6-1.75-5.35-2.22-8.25-1.3V5.4Zm16.5 0c-2.9-.92-5.65-.45-8.25 1.3v12.1c2.6-1.75 5.35-2.22 8.25-1.3V5.4ZM12 6.7v12.1"/></svg>`,
  group: `<svg class="hierarchy-icon hierarchy-icon-group" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="hierarchy-icon-fill" d="m12 3.4 9 4.5-9 4.5-9-4.5 9-4.5Z"/><path d="m3 7.9 9-4.5 9 4.5-9 4.5-9-4.5Zm0 4.1 9 4.5 9-4.5M3 16.1l9 4.5 9-4.5"/></svg>`,
  section: `<svg class="hierarchy-icon hierarchy-icon-section" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="hierarchy-icon-fill" d="M6.5 3.5h11v17L12 17.2l-5.5 3.3v-17Z"/><path d="M6.5 3.5h11v17L12 17.2l-5.5 3.3v-17Z"/></svg>`,
  label: `<svg class="hierarchy-icon hierarchy-icon-label" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="hierarchy-icon-fill" d="M12.7 3.5H5.3c-1 0-1.8.8-1.8 1.8v7.4l7.8 7.8 9.2-9.2-7.8-7.8Z"/><path d="M12.7 3.5H5.3c-1 0-1.8.8-1.8 1.8v7.4l7.8 7.8 9.2-9.2-7.8-7.8Z"/><circle cx="8" cy="8" r="1.15"/></svg>`,
};

function hierarchyIcon(kind) {
  return HIERARCHY_ICONS[kind] || "";
}

export function chapterContext(index, idiomIndex, content=null) {
 const state={indexWords:index.words,headwordIndex:new Map(),wordIndex:new Map()};
 const dependencies=new Set();
 const resolveRef=headword=>{dependencies.add(headword.toLowerCase());const hit=state.wordIndex.get(headword.toLowerCase());return hit?{found:true,id:hit.id,no:hit.no}:state.idiomResolver?.(headword)||{found:false};};
 const resolveHeadwordRef=headword=>{dependencies.add(headword.toLowerCase());const hit=state.headwordIndex.get(headword.toLowerCase());return hit?{found:true,id:hit.id,no:hit.no}:{found:false};};
 for(const w of index.words)if(w.branch===0)state.headwordIndex.set(w.spelling.toLowerCase(),{id:w.id,no:w.seqNo});
 for(const w of index.words)if(!state.headwordIndex.has(w.spelling.toLowerCase()))state.headwordIndex.set(w.spelling.toLowerCase(),{id:w.id,no:w.seqNo});
 const derivatives=collectDerivativeCrossReferences(index.words);
 state.wordIndex=addDerivativeCrossReferenceAliases(state.headwordIndex,derivatives);
 if(idiomIndex)state.idiomResolver=createIdiomReferenceResolver(groupIdiomEntries(resolveIdiomReferences(idiomIndex.entries,index.words),idiomIndex.chapters),resolveHeadwordRef);
 // Only phrases occurring in these bodies can match. Keep the complete
 // resolver, but avoid compiling a whole-book alternation for every fragment.
 const texts=[];
 const collect=value=>{if(typeof value==='string')texts.push(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);};
 if(content)collect(content);
 const haystack=texts.join('\n').toLowerCase().replace(/ſ/g,'s');
 const relevant=term=>!content||/[^\x00-\x7f]/.test(term)||haystack.includes(term.toLowerCase());
 const idiomPhrases=(state.idiomResolver?.phrases||[]).filter(relevant);
 const renderNotesMarkup=createAutoCrossRefRenderer([...state.headwordIndex.keys(),...idiomPhrases].filter(relevant),{resolve:resolveRef,derivativeReferences:derivatives.filter(r=>relevant(r.derivative)),idiomReferences:idiomPhrases,phraseReferences:collectPhraseCrossReferences(index.words).filter(r=>relevant(r.phrase))});
 return {resolveRef,resolveHeadwordRef,renderNotesMarkup,origin:'https://vocab.lrnr.jp',dependencies};
}
export function renderWordChapter(index,idiomIndex,chapterId,shards,onlySections=null) {
 const context=chapterContext(index,idiomIndex,shards);
 const state={...index,indexWords:index.words};
 const numbers=new Map(index.words.map(w=>[w.id,w.seqNo]));
 const renderEntry=w=>renderWordEntry({...w,seqNo:numbers.get(w.id)||''},context);
function hasAnySection() {
  return state.sections.some((section) => section.id != null);
}

function hasAnyChapter() {
  return state.chapters.some((chapter) => chapter.id != null);
}

function hasAnyGroup() {
  return state.groups.some((group) => group.id != null);
}

function renderSectionEntriesHtml(words, sectionKey) {
  const withLabels = state.indexWords.some((word) => word.labelId != null);
  let lastLabelKey;
  const parts = [];
  for (const word of words) {
    const labelKey = word.labelId != null ? String(word.labelId) : `none-${sectionKey}`;
    if (withLabels && word.labelId != null && labelKey !== lastLabelKey) {
      parts.push(`<div class="label-divider" data-label-key="${escapeHtml(labelKey)}" role="heading" aria-level="5">${hierarchyIcon("label")}<span class="label-title">${escapeHtml(word.labelName || "")}</span></div>`);
    }
    lastLabelKey = labelKey;
    parts.push(renderEntry(word));
  }
  return parts.join("");
}

function renderSectionShells() {
  const withSections = hasAnySection();
  const withChapters = hasAnyChapter();
  const withGroups = hasAnyGroup();
  const chapterByKey = new Map(state.chapters.map((chapter) => [String(chapter.key), chapter]));
  const chapterToneByKey = new Map(state.chapters.map((chapter, index) => [String(chapter.key), (index % 6) + 1]));
  const groupByKey = new Map(state.groups.map((group) => [String(group.key), group]));
  let lastChapterKey;
  let lastGroupKey;
  const parts = [];
  for (const [sectionIndex, section] of state.sections.entries()) {
    const chapterKey = String(section.chapterKey);
    if(chapterKey!==String(chapterId))continue;
    const chapter = chapterByKey.get(chapterKey);
    const chapterChanged = withChapters && chapterKey !== lastChapterKey;
    let chapterMarkup = "";
    if (chapterChanged) {
      lastChapterKey = chapterKey;
      lastGroupKey = undefined;
      const titleLine = `<span class="chapter-title">${escapeHtml(chapter?.name || "その他")}</span>${
        chapter?.subtitle ? `<span class="chapter-subtitle">${escapeHtml(chapter.subtitle)}</span>` : ""
      }`;
      chapterMarkup = `<div class="chapter-divider" id="chapter-${escapeHtml(chapterKey)}" data-chapter-key="${escapeHtml(chapterKey)}" role="heading" aria-level="2">${hierarchyIcon("chapter")}<div class="chapter-title-row">${titleLine}</div></div>`;
    }
    const groupKey = section.groupId != null ? String(section.groupKey) : null;
    const group = groupKey ? groupByKey.get(groupKey) : null;
    const groupChanged = withGroups && !!group && groupKey !== lastGroupKey;
    let groupMarkup = "";
    if (groupChanged) {
      const titleLine = `<span class="group-title">${escapeHtml(group.name)}</span>${
        group.subtitle ? `<span class="group-subtitle">${escapeHtml(group.subtitle)}</span>` : ""
      }`;
      groupMarkup = `<div class="group-divider" id="group-${escapeHtml(groupKey)}" data-group-key="${escapeHtml(groupKey)}" role="heading" aria-level="3">${hierarchyIcon("group")}<div class="group-title-row">${titleLine}</div></div>`;
    }
    lastGroupKey = groupKey;
    const key = String(section.key);
    const titleLine = `<span class="section-title">${escapeHtml(section.name || "その他")}</span>${
      section.subtitle ? `<span class="section-subtitle">${escapeHtml(section.subtitle)}</span>` : ""
    }`;
    const divider = withSections
      ? `<div class="section-divider" id="section-${escapeHtml(key)}" data-section-key="${escapeHtml(key)}" role="heading" aria-level="4">${hierarchyIcon("section")}<div class="section-title-row">${titleLine}</div></div>`
      : "";
    const sectionTone = withSections ? ` section-tone-${(sectionIndex % 6) + 1}` : "";
    const chapterTone = ` chapter-tone-${chapterToneByKey.get(chapterKey) || 1}`;
    const chapterClass = chapterMarkup ? " has-chapter-divider" : "";
    const groupClass = groupMarkup ? " has-group-divider" : "";
    const chapterFrameId = chapterMarkup ? ` id="chapter-frame-${escapeHtml(chapterKey)}"` : "";
    const labelledBy = withSections ? ` aria-labelledby="section-${escapeHtml(key)}"` : "";
    const placeholderHeight = Math.min(900, Math.max(160, section.count * 44));
    if(!onlySections||onlySections.has(key))parts.push(
      `<section class="section-group${sectionTone}${chapterTone}${chapterClass}${groupClass}"${chapterFrameId} data-section-key="${escapeHtml(key)}" data-chapter-key="${escapeHtml(chapterKey)}" data-group-key="${escapeHtml(groupKey || "none")}"${labelledBy}>${chapterMarkup}${groupMarkup}${divider}<div class="section-entries" data-section-entries="${escapeHtml(key)}" aria-busy="false">${renderSectionEntriesHtml(shards[key]?.words||[],key)}</div></section>`
    );
  }

  return parts.join("");
}

 const html=renderSectionShells();
 return {html,dependencies:[...context.dependencies]};
}
export function renderIdiomChapter(index,idiomIndex,chapterId,shards,onlySections=null) {
 const context=chapterContext(index,idiomIndex,shards);
 const full=new Map(Object.values(shards).flatMap(s=>s.entries||[]).map(e=>[e.key,e]));
 const entries=idiomIndex.entries.map(e=>full.get(e.key)||e);
 const groups=groupIdiomEntries(resolveIdiomReferences(entries,index.words),idiomIndex.chapters);
 const chapter=groups.find(c=>String(c.key)===String(chapterId));
 if(!chapter)return {html:'',dependencies:[]};
 const html=chapter.sections.map((section,n)=>{
 if(onlySections&&!onlySections.has(section.key))return '';
 let label=null;
 const body=section.items.map(item=>{const next=(section.labels||[]).find(l=>l.key===item.labelKey);const heading=next&&next.key!==label?`<div class="label-divider" role="heading" aria-level="5">${hierarchyIcon('label')}<span class="label-title">${escapeHtml(next.name)}</span></div>`:'';label=next?.key;return heading+renderIdiomEntry(item,context.origin,{resolve:context.resolveRef,renderNotes:context.renderNotesMarkup});}).join('');
 const group=section.groupKey&&section.groupKey!==chapter.sections[n-1]?.groupKey?`<div class="group-divider" id="idiom-group-${escapeHtml(section.groupKey)}" role="heading" aria-level="3">${hierarchyIcon('group')}<div class="group-title-row"><span class="group-title">${escapeHtml(section.groupName)}</span><span class="group-subtitle">${escapeHtml(section.groupSubtitle)}</span></div></div>`:'';
 return `<section class="section-group chapter-tone-${chapter.tone}" data-static-idiom-section="${escapeHtml(section.key)}">${n===0?`<div class="chapter-divider" id="idiom-chapter-${escapeHtml(chapter.key)}" role="heading" aria-level="2">${hierarchyIcon('chapter')}<div class="chapter-title-row"><span class="chapter-title">${escapeHtml(chapter.name)}</span><span class="chapter-subtitle">${escapeHtml(chapter.subtitle)}</span></div></div>`:''}${group}<div class="section-divider" id="idiom-section-${escapeHtml(section.key)}" data-idiom-section="${escapeHtml(section.key)}" role="heading" aria-level="4">${hierarchyIcon('section')}<div class="section-title-row"><span class="section-title">${escapeHtml(section.name)}</span><span class="section-subtitle">${escapeHtml(section.subtitle)}</span></div></div><div class="idiom-entries" data-idiom-section-entries="${escapeHtml(section.key)}">${body}</div></section>`;
 }).join('');
 return {html,dependencies:[...context.dependencies]};
}
