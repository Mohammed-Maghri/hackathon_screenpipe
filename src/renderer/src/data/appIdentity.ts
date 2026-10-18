const aliases:Record<string,string>={
 'em dash':'EmDash','emdash desktop':'EmDash',
 'google chrome':'Chrome','google-chrome':'Chrome','google-chrome-stable':'Chrome','com.google.chrome':'Chrome',browser:'Chrome',
 'google drive':'Drive','microsoft excel':'Excel','microsoft outlook':'Outlook','google mail':'Gmail','google gmail':'Gmail',
 'screen pipe':'Screenpipe','screenpipe-app':'Screenpipe','screenpipe app':'Screenpipe','com.screenpipe.app':'Screenpipe',
 'chat gpt':'ChatGPT','chatgpt desktop':'ChatGPT','com.openai.chat':'ChatGPT',openai:'ChatGPT',
 'openai codex':'Codex','chatgpt codex':'Codex','chatgpt - codex':'Codex','codex desktop':'Codex','codex app':'Codex','com.openai.codex':'Codex',
 'discord canary':'Discord','discord ptb':'Discord',discordcanary:'Discord',discordptb:'Discord','com.discordapp.discord':'Discord',
 'slack desktop':'Slack','com.slack.slack':'Slack','com.tinyspeck.slackmacgap':'Slack',
}
const names=['EmDash','Slack','Microsoft','Google','Excel','Outlook','Gmail','Drive','Chrome','Notion','Screenpipe','ChatGPT','Codex','Discord']
export function appIdentity(app:string):string {
 const normalized=app.trim().toLowerCase().replace(/\.(exe|desktop|app)$/,'').replace(/\s+\(\d+\)$/,'').replace(/\s+/g,' ')
 return aliases[app.trim().toLowerCase()]??aliases[normalized]??names.find(name=>name.toLowerCase()===normalized)??app
}
