import { Context, Schema } from 'koishi'
import {} from '@koishijs/plugin-adapter-onebot'

export const name = 'unban-rank'

export interface Config {
  defaultNumber:number
}

export const Config: Schema<Config> = Schema.object({
  defaultNumber:Schema.number().default(10).description("默认显示数量")
})

declare module 'koishi'{
  interface Tables{
    unbanRank: UnbanRank
  }
}

export interface UnbanRank{
  id:number
  qq:number
  group:number
  banned:number
  usetime:number
}

function toSec(input:number){
  return Math.floor(input/10)/100
}

export function apply(ctx: Context,config:Config) {
  ctx.model.extend(
    'unbanRank',
    {
      id: {
        type: 'unsigned',
        length: 10,
        nullable: false,
      },
      qq: {
        type: 'unsigned',
        length: 11,
        nullable: false,
      },
      group: {
        type: 'unsigned',
        length: 11,
        nullable: false,
      },
      banned: {
        type: 'unsigned',
        length: 13,
        nullable: false,
      },
      usetime: {
        type: 'unsigned',
        length: 13,
        nullable: true,
      },
    },
    {
      autoInc: true,
      unique: [['qq', 'group']],
    }
  )

  // 监听事件
  ctx.on("guild-member/ban",async (session)=>{
    if(session?.onebot.sub_type == "ban"){
      // 侦测到禁言
      const qq = Number(session.userId)
      const group = Number(session.channelId)
      const banned = new Date().getTime()
      ctx.database.upsert('unbanRank',[{qq, group, banned}],['qq', 'group'])
    }else if(session?.onebot.sub_type != "unban"){
      // 侦测到解除禁言
      // 侦测到禁言
      const qq = Number(session.userId)
      const group = Number(session.channelId)
      const history = await ctx.database.get('unbanRank',{qq,group,banned:{$ne:0}})
      if(history && history[0]){
        const unbanned = new Date().getTime()
        const usetime1 = unbanned-history[0].banned
        const usetime2 = history[0].usetime
        const usetime = (usetime2&&(usetime2<usetime1))?usetime2:usetime1
        ctx.database.upsert('unbanRank',[
          {qq, group, banned:0,usetime}
        ],['qq', 'group'])
      }
    }
  },true)

  ctx.command("unbanrank")
    .option("me",'-m')
    .action(async ({session,options})=>{
      const group = Number(session.channelId)
      const list = (await ctx.database.get('unbanRank',{
        group,
        usetime:{$gt:0}
      })).sort((a,b)=>a.usetime-b.usetime)  
      if(options.me){
        const rank = list.findIndex((i)=>i.qq.toString() == session.userId) + 1
        if(!rank) return `无有效数据`
        const time = list[rank-1].usetime
        return `你在本群的解禁排名为：${rank}，用时${toSec(time)}s。`
      }else{
        let result = ``
        for(let i=0;i<config.defaultNumber && i<list.length;i++){
          const name = 
            (await (session?.onebot.getGroupMemberInfo(group,list[i].qq))).nickname||
            list[i].qq
          result +=  `${i+1}:${name}\t${toSec(list[i].usetime)}s\n`
        }
        return result
      }
    })


}
