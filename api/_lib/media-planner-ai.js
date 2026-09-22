'use strict';
const {fail}=require('./media-db');

const string={type:'string'};
const direction={type:'object',additionalProperties:false,required:['title','description','media_type'],properties:{title:string,description:string,media_type:{type:'string',enum:['image','motion','game']}}};
const schema={type:'object',additionalProperties:false,required:['assistant_message','media_brief','suggested_directions','open_questions','ready_to_build'],properties:{
  assistant_message:string,
  media_brief:{type:'object',additionalProperties:false,required:['topic','audience','learning_message','media_type','concept','content_structure','visual_direction','interaction_direction','tone','constraints'],properties:{
    topic:string,audience:string,learning_message:string,media_type:{type:'string',enum:['','image','motion','game']},concept:string,content_structure:string,visual_direction:string,interaction_direction:string,tone:string,constraints:{type:'array',items:string}
  }},
  suggested_directions:{type:'array',items:direction},open_questions:{type:'array',items:string},ready_to_build:{type:'boolean'}
}};
const instructions='You are the ClassKru Media Studio Planner, a Thai-speaking thinking partner for teachers. Turn even one topic into a clear brief for creating an image, motion media, or game. Do not write a classroom lesson plan and do not focus on classroom logistics. Ask at most three useful follow-up questions, but still make reasonable suggestions when information is missing. Never invent personal student data. Explain assumptions briefly in assistant_message. Return only JSON matching the supplied schema. media_brief is the accumulated design brief; keep media_type empty when no type is chosen. Set ready_to_build true only when a reasonable first media draft can be generated.';

function configured(){return Boolean(process.env.OPENROUTER_MEDIA_PLANNER_API_KEY||process.env.OPENROUTER_API_KEY);}
async function ask(data){
  const apiKey=process.env.OPENROUTER_MEDIA_PLANNER_API_KEY||process.env.OPENROUTER_API_KEY;
  if(!apiKey) throw fail('ai_not_configured',503);
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`,'HTTP-Referer':process.env.OPENROUTER_SITE_URL||process.env.CLASSKRU_APP_ORIGIN||'https://classkru-kohl.vercel.app','X-Title':'ClassKru Media Studio Planner'},signal:AbortSignal.timeout(60000),body:JSON.stringify({
    model:process.env.OPENROUTER_MEDIA_PLANNER_MODEL||process.env.OPENROUTER_MEDIA_MODEL||process.env.OPENROUTER_MODEL||'qwen/qwen3-30b-a3b-instruct-2507',temperature:0.25,max_tokens:3000,
    provider:{data_collection:'deny',require_parameters:true},response_format:{type:'json_schema',json_schema:{name:'media_studio_planner',strict:true,schema}},
    messages:[{role:'system',content:instructions+'\nReturn JSON only according to this schema: '+JSON.stringify(schema)},{role:'user',content:JSON.stringify(data)}]
  })});
  if(!response.ok) throw fail(response.status===429?'ai_busy':'ai_request_failed',502);
  const payload=await response.json(),choice=payload.choices?.[0];
  if(choice?.finish_reason!=='stop') throw fail('ai_incomplete',502);
  try{return JSON.parse(String(choice.message?.content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch(_){throw fail('ai_invalid_response',502);}
}
module.exports={ask,configured,schema};
