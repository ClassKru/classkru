'use strict';
const {fail}=require('./media-db');
function configured(){return Boolean(process.env.OPENROUTER_MEDIA_PLANNER_API_KEY||process.env.OPENROUTER_MEDIA_IMAGE_API_KEY||process.env.OPENROUTER_API_KEY);}
async function generate(input){
  const apiKey=process.env.OPENROUTER_MEDIA_IMAGE_API_KEY||process.env.OPENROUTER_MEDIA_PLANNER_API_KEY||process.env.OPENROUTER_API_KEY;
  if(!apiKey) throw fail('ai_not_configured',503);
  const prompt=input.prompt_override||[input.topic&&`Topic: ${input.topic}`,input.audience&&`Audience: ${input.audience}`,input.learning_message&&`Learning message: ${input.learning_message}`,input.concept&&`Concept: ${input.concept}`,input.content_structure&&`Content structure: ${input.content_structure}`,input.visual_direction&&`Visual direction: ${input.visual_direction}`,input.tone&&`Tone: ${input.tone}`,Array.isArray(input.constraints)&&input.constraints.length&&`Constraints: ${input.constraints.join('; ')}`].filter(Boolean).join('\n');
  const response=await fetch('https://openrouter.ai/api/v1/images',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`,'HTTP-Referer':process.env.OPENROUTER_SITE_URL||process.env.CLASSKRU_APP_ORIGIN||'https://classkru-kohl.vercel.app','X-Title':'ClassKru Media Studio Image'},signal:AbortSignal.timeout(170000),body:JSON.stringify({model:process.env.OPENROUTER_MEDIA_IMAGE_MODEL||'google/gemini-3.1-flash-image',prompt,n:1,aspect_ratio:'16:9'})});
  if(!response.ok){const detail=(await response.text().catch(()=>'' )).slice(0,1000);console.error(`[media-image] OpenRouter ${response.status}`,detail);const code=response.status===401||response.status===403?'ai_auth_failed':response.status===402?'ai_credit_required':response.status===429?'ai_busy':response.status>=500?'ai_provider_failed':'ai_request_failed';throw fail(code,502);}
  const payload=await response.json(),item=payload.data?.[0];
  if(!item?.b64_json) throw fail('ai_invalid_response',502);
  return {b64_json:item.b64_json,mime_type:item.media_type||'image/png'};
}
module.exports={configured,generate};
