import { verifyMcpAccess, oauthErrorResponse, MCP_READ_SCOPE, MCP_WRITE_SCOPE } from './mcp-oauth.js';
import { wordHistory, illustrationConfiguration, saveIllustrationBrief, enqueueIllustration, restoreIllustration } from './word-illustrations.js';

const schema = (properties, required) => ({ type:'object', properties, required, additionalProperties:false });
const text = { type:'string' };
const definitions = [
  { name:'get_word_illustration', title:'単語のイラストと生成履歴',
    description:'crossoverの単語IDを指定し、描く語義・場面・表示中画像・生成履歴・設定状態を確認します。',
    inputSchema:schema({word_id:text},['word_id']), readOnly:true },
  { name:'generate_word_illustration', title:'単語イラストを生成・差し替え',
    description:'crossoverの1単語の白黒線画をAPI生成待ちへ登録します。生成成功時に単語帳へ自動表示し、既存画像は履歴に残します。API利用料が発生します。先にget_word_illustrationで登録語義を確認し、posとmeaningをそのまま指定してください。request_idはUUIDとし、通信再試行時は同じ値を使ってください。',
    inputSchema:schema({word_id:text,request_id:{type:'string',format:'uuid'},pos:text,meaning:text,scene:text,avoid:text},['word_id','request_id','pos','meaning','scene','avoid']) },
  { name:'restore_word_illustration', title:'過去のイラストに戻す',
    description:'生成履歴で確認した画像IDに表示を戻します。新しい画像生成・API課金は行いません。',
    inputSchema:schema({word_id:text,job_id:text},['word_id','job_id']) },
];
export const ILLUSTRATION_MCP_TOOLS = definitions.flatMap(({readOnly,...tool}) => {
  const value={...tool,securitySchemes:[{type:'oauth2',scopes:readOnly?[MCP_READ_SCOPE]:[MCP_READ_SCOPE,MCP_WRITE_SCOPE]}],
    annotations:{readOnlyHint:!!readOnly,destructiveHint:false,openWorldHint:!readOnly}};
  return [value,{...value,name:'vocab.'+value.name}];
});

export async function handleIllustrationMcp(request, env, delegate) {
  const path=new URL(request.url).pathname.replace(/\/+$/,'');
  if (!['/mcp','/mcp-write'].includes(path) || request.method!=='POST') return null;
  let message;
  try { message=await request.clone().json(); } catch { return null; }
  if(message.method==='tools/list') {
    const response=await delegate(request);
    const payload=await response.clone().json().catch(()=>null);
    if(!Array.isArray(payload?.result?.tools))return response;
    const existing=new Set(payload.result.tools.map(t=>t.name));
    payload.result.tools.push(...ILLUSTRATION_MCP_TOOLS.filter(t=>!existing.has(t.name)));
    const headers=new Headers(response.headers);headers.delete('content-length');
    return new Response(JSON.stringify(payload),{status:response.status,headers});
  }
  const name=String(message.params?.name || '').replace(/^vocab\./,'');
  const tool=definitions.find(t=>t.name===name);
  if(message.method!=='tools/call' || !tool)return null;
  // Paid generation always requires OAuth, including in the legacy anonymous-write mode.
  const scopes=tool.readOnly?[MCP_READ_SCOPE]:[MCP_READ_SCOPE,MCP_WRITE_SCOPE];
  try { await verifyMcpAccess(request,env,scopes); }
  catch(e) { return oauthErrorResponse(request,e,scopes); }
  const args=message.params.arguments || {};
  let result;
  try {
    let data;
    if(name==='get_word_illustration') data={...await wordHistory(env,args.word_id),config:illustrationConfiguration(env)};
    if(name==='generate_word_illustration') {
      await saveIllustrationBrief(env,args.word_id,args);
      data=await enqueueIllustration(env,args.word_id,args.request_id);
    }
    if(name==='restore_word_illustration') data=await restoreIllustration(env,args.word_id,args.job_id);
    result={isError:false,structuredContent:data,content:[{type:'text',text:JSON.stringify(data)}]};
  } catch(e) { result={isError:true,content:[{type:'text',text:e.status?e.message:'イラストの処理に失敗しました'}]}; }
  return Response.json({jsonrpc:'2.0',id:message.id,result},{headers:{'cache-control':'no-store','access-control-allow-origin':'*'}});
}
