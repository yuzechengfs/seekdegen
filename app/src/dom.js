import { titleMap } from "./config.js";
import { state } from "./state.js";

const exactTextReplacements = [
  ["先共振，再聊天。", "Feel the spark, then start the chat."],
  ["连接钱包，进入你的 Heart Signal。", "Connect your wallet to enter Degen Signal."],
  ["连接钱包", "Connect Wallet"],
  ["重试", "Try Again"],
  ["返回", "Back"],
  ["基础资料", "Profile"],
  ["完成资料", "Complete your profile"],
  ["这些字段会决定推荐的基础边界。", "These details shape your recommendations and boundaries."],
  ["昵称", "Nickname"],
  ["城市", "City"],
  ["年龄", "Age"],
  ["匹配偏好", "Matching preference"],
  ["继续", "Continue"],
  ["人格卡", "Signal Profile"],
  ["约 2 分钟", "About 2 min"],
  ["下一题", "Next"],
  ["人格结果", "Your result"],
  ["已生成", "Ready"],
  ["完成第一条信号", "Complete your first signal"],
  ["信号站", "Signal Hub"],
  ["根据信号推荐", "Curated from your signals"],
  ["探索", "Explore"],
  ["候选对象列表", "Potential matches"],
  ["剧情房", "Story Room"],
  ["先互动再聊天", "Warm up before chat"],
  ["消息", "Messages"],
  ["只展示已解锁关系", "Unlocked connections only"],
  ["我的", "Me"],
  ["人格与边界", "Profile and boundaries"],
  ["推荐", "Recommended"],
  ["同信号", "Shared Signal"],
  ["同城", "Same City"],
  ["新加入", "New"],
  ["回看", "Review"],
  ["已连接钱包", "Wallet connected"],
  ["请在钱包中确认", "Confirm in your wallet"],
  ["登录成功", "Signed in"],
  ["未检测到可用钱包。", "No wallet detected."],
  ["请先打开钱包", "Open your wallet first"],
  ["正在连接钱包...", "Connecting wallet..."],
  ["连接失败，请重试。", "Could not connect. Try again."],
  ["连接失败，请重试", "Could not connect"],
  ["暂时无法进入，请重试。", "Can't enter right now. Try again."],
  ["正在重新尝试...", "Trying again..."],
  ["登录状态已失效，请重新登录。", "Your session expired. Sign in again."],
  ["可发起回应", "Ready to respond"],
  ["等待对方处理", "Waiting on them"],
  ["剧情房进行中", "Story room active"],
  ["聊天已解锁", "Chat unlocked"],
  ["已跳过", "Skipped"],
  ["全部", "All"],
  ["已收藏", "Saved"],
  ["已回应", "Responded"],
  ["已放回", "Restored"],
  ["可重新推进", "Ready to revisit"],
  ["阶段优先", "Stage first"],
  ["最近动作", "Latest activity"],
  ["收藏优先", "Saved first"],
  ["进入候选池", "Shown to you"],
  ["加入收藏", "Saved"],
  ["取消收藏", "Unsaved"],
  ["发出回应", "Response sent"],
  ["进入剧情房", "Entered story room"],
  ["聊天解锁", "Chat unlocked"],
  ["有新动作", "New activity"],
  ["暂无", "Not yet"],
  ["慢热共振型", "Slow Resonance"],
  ["稳定陪伴型", "Steady Companion"],
  ["细节观察型", "Detail Observer"],
  ["夜聊流动型", "Night Flow"],
  ["节奏安全", "Pace Safety"],
  ["稳定推进", "Steady Momentum"],
  ["细节感知", "Detail Awareness"],
  ["在场回应", "Present Response"],
  ["先写一条真实但不冒进的今日信号，系统会更偏向稳定推进型候选。", "Write one honest but unforced signal today. The system will lean toward steadier matches."],
  ["优先打开边界设置，把你能接受的节奏先讲清楚，再进入推荐。", "Set your boundaries first so your pace is clear before recommendations open up."],
  ["先完成今日信号，再根据推荐理由挑一个最值得推进的人。", "Finish today's signal first, then pick the person with the strongest recommendation reason."],
  ["系统根据你的人格题结果，判断你更偏向稳定、慢热、重视被理解的关系节奏。", "Based on your answers, your relationship style leans steady, slow-build, and strongly values being understood."],
  ["进入系统前的第一步", "First move before you start"],
  ["快速边界设置", "Quick boundary setup"],
  ["仅看同城", "Same city only"],
  ["允许主动回应", "Allow proactive responses"],
  ["展示城市", "Show city"],
  ["进入信号站后你会看到什么", "What you will see next"],
  ["1. 今日信号任务，用一句话告诉系统你的关系偏好。", "1. A daily signal prompt, so the system understands your relationship pace."],
  ["2. 推荐解释，不只是给人，还会告诉你为什么是她。", "2. Recommendation reasons, so you know why each person appears."],
  ["3. 如果双向成立，会先进入剧情房，再解锁聊天。", "3. If interest matches on both sides, you enter a story room before chat unlocks."],
  ["进入信号站", "Enter Degen Signal"],
  ["边界设置已保存", "Boundaries saved"],
  ["首次进入引导", "Getting started"],
  ["先发一条今日信号，再进入推荐", "Send today's signal before you explore"],
  ["1. 今天先选择你现在最关注的加密赛道。", "1. Start by choosing the crypto sector you care about most right now."],
  ["2. 推荐页会根据这条信号和你的人格卡给出解释，不是直接盲刷。", "2. Recommendations are explained through your signal and profile, not blind swiping."],
  ["3. 如果双向成立，会先进入剧情房，再解锁聊天。", "3. If the match is mutual, you enter a story room before chat unlocks."],
  ["今日信号任务", "Today's signal"],
  ["已完成", "Done"],
  ["查看推荐", "View matches"],
  ["待完成", "Pending"],
  ["输入一句真实回答", "Write one honest line"],
  ["发送今日信号", "Send today's signal"],
  ["待完成剧情房", "Pending story room"],
  ["还有最后一轮互动，完成后会解锁聊天。", "There is one final round left. Finish it to unlock chat."],
  ["继续互动", "Continue"],
  ["今日推荐摘要", "Today's summary"],
  ["完整推荐已开放", "Full recommendations unlocked"],
  ["推荐待解锁", "Recommendations locked"],
  ["当前可见推荐：", "Visible matches: "],
  [" 人。未读消息 ", " · Unread messages "],
  ["下一步：", "Next: "],
  ["先完成剧情房，当前这段关系已经比继续刷人更值。", "Finish the story room first. This connection matters more than browsing further right now."],
  ["去探索页看解释最强的一位候选，再决定是否回应。", "Go to Explore, review the strongest reason, then decide whether to respond."],
  ["先完成今日信号，推荐才会真正开放。", "Finish today's signal before recommendations fully open."],
  ["先写下一句真实回答", "Write a real answer first"],
  ["今日信号已发送，推荐已开放", "Today's signal sent. Recommendations are open."],
  ["信号发送失败", "Couldn't send your signal"],
  ["推荐暂未完全开放", "Recommendations are not open yet"],
  ["先完成今天的信号任务，系统才会把更准确的人推荐给你。", "Finish today's signal first so the system can show more accurate matches."],
  ["详情", "details"],
  ["收藏待看", "Save for later"],
  ["撤销跳过", "Undo skip"],
  ["回到推荐", "Back to recommended"],
  ["举报", "Report"],
  ["拉黑", "Block"],
  ["为什么现在推荐她", "Why you're seeing her now"],
  ["共享点", "What you share"],
  ["还在观察中", "Still learning"],
  ["边界适配", "Boundary fit"],
  ["当前阶段", "Current stage"],
  ["同城判断", "Same city"],
  ["是", "Yes"],
  ["否", "No"],
  ["你的同城限制", "Your city filter"],
  ["已开启", "On"],
  ["未开启", "Off"],
  ["下一步建议", "Next best move"],
  ["人格匹配分", "Persona score"],
  ["信号共振分", "Signal score"],
  ["关系阶段分", "Stage score"],
  ["最近信号", "Latest signal"],
  ["关系时间线", "Connection timeline"],
  ["还没有更多互动记录。", "No interaction history yet."],
  ["已加入收藏，方便之后回看", "Saved for later"],
  ["已取消收藏", "Removed from saved"],
  ["这位候选人已放回推荐", "This person is back in your recommendations"],
  ["已切回推荐视图", "Back to recommended"],
  ["前端演示举报入口", "Report submitted from candidate detail"],
  ["举报已提交，系统会暂时隐藏这位用户", "Report submitted. This user is now hidden while the review is pending."],
  ["已拉黑，这位用户已从当前视图移除", "Blocked. This user has been removed from your current view."],
  ["回看总览", "Review overview"],
  ["当前共有 ", "You currently have "],
  [" 条可回看关系", " reviewable connections"],
  ["最近 3 次动作", "Last 3 actions"],
  ["当前还没有可摘要的动作。", "There are no recent actions yet."],
  ["只看可重新推进", "Show ready-to-revisit only"],
  ["恢复全部已跳过", "Restore all skipped"],
  ["回看排序", "Review sort"],
  ["回看筛选", "Review filters"],
  ["当前没有可恢复的已跳过对象", "No skipped people to restore"],
  ["已恢复 ", "Restored "],
  [" 个已跳过对象", " skipped people"],
  ["这一栏目前没有候选人", "No one is available in this tab yet"],
  ["换一个筛选，或者先去产生新的收藏、跳过、回应记录。", "Try another filter or create new saved, skipped, or response activity first."],
  ["可以切换其他分栏，或者调整“我的”里的边界设置再看一轮。", "Try another tab or adjust your boundaries in Me and check again."],
  ["最近回答：", "Latest answer: "],
  ["推荐理由", "Why this match"],
  ["最近动作：", "Latest action: "],
  ["还没有明显动作", "No major action yet"],
  ["记录 ", ""],
  [" 条。", " entries."],
  ["查看详情", "View details"],
  ["收藏", "Save"],
  ["进入剧情房", "Open story room"],
  ["已回应", "Responded"],
  ["去聊天", "Open chat"],
  ["回应", "Respond"],
  ["跳过", "Skip"],
  ["已降低这位候选人的曝光", "This person will show up less often"],
  ["你的这条回答让我有点想继续了解。", "Your answer made me want to know you better."],
  ["回应成立，已进入剧情房", "It's a match. You're now in the story room."],
  ["回应已送达，等待对方查看", "Response sent. Waiting for them to see it."],
  ["回应发送失败", "Couldn't send your response"],
  ["当前关系还在等待推进", "This connection is still waiting to move forward"],
  ["剧情房列表", "Story rooms"],
  ["还没有进行中的剧情房", "No active story room yet"],
  ["先在探索页发起回应，双向成立后才会进入剧情房。", "Start by responding in Explore. A mutual match opens the story room."],
  ["这段剧情已完成，聊天已解锁。", "This story room is complete and chat is unlocked."],
  ["当前进行中：", "In progress: "],
  ["进行中", "In progress"],
  ["查看完成状态", "View completed room"],
  ["打开当前剧情房", "Open story room"],
  ["剧情房对象", "Story partner"],
  ["剩余时间：", "Time left: "],
  ["当前状态", "Current status"],
  ["剧情房已完成", "Story room complete"],
  ["最后一轮已经提交，关系已进入已解锁聊天。", "The final round is done and chat is now unlocked."],
  ["进入聊天", "Enter chat"],
  ["当前情境", "Current prompt"],
  ["提交答案", "Submit answer"],
  ["系统观察", "System note"],
  ["默契摘要", "Connection summary"],
  ["剧情房完成，聊天已解锁", "Story room complete. Chat unlocked."],
  ["已解锁聊天", "Unlocked chats"],
  ["最近一条：", "Latest: "],
  ["打开聊天", "Open chat"],
  ["消息状态", "Message status"],
  ["聊天还没解锁", "Chat is not unlocked yet"],
  ["完成剧情房 3 轮互动后，消息才会出现在这里。", "Messages appear here after you finish all 3 story room rounds."],
  ["待处理回应", "Incoming responses"],
  ["对方最近信号：", "Their latest signal: "],
  ["接受并进入剧情房", "Accept and enter story room"],
  ["当前没有可见聊天线程。", "No visible chat thread yet."],
  ["举报对方", "Report"],
  ["继续聊天", "Keep chatting"],
  ["输入一条消息", "Write a message"],
  ["发送消息", "Send message"],
  ["先完成剧情房，再回来这里。", "Finish the story room first, then come back here."],
  ["先输入一条消息", "Write a message first"],
  ["消息已发送", "Message sent"],
  ["消息发送失败", "Couldn't send message"],
  ["聊天页举报入口", "Report submitted from chat"],
  ["举报已提交，该聊天会暂时从列表隐藏", "Report submitted. This chat is now hidden while the review is pending."],
  ["已拉黑，对方已从消息与推荐中移除", "Blocked. They were removed from messages and recommendations."],
  ["回应已接受，已进入剧情房", "Response accepted. You're now in the story room."],
  ["今天还没有发出新的信号。", "No new signal has been sent today."],
  ["保存资料", "Save profile"],
  ["退出登录", "Sign out"],
  ["系统会把这类表达用于推荐解释和回应入口。", "The system uses this style of expression to explain recommendations and responses."],
  ["当前剧情房", "Active story rooms"],
  ["允许主动回应", "Allow proactive responses"],
  ["安全管理", "Safety"],
  ["举报 ", "Reports "],
  [" 条 · 黑名单 ", " · Blocklist "],
  [" 人", ""],
  [" 个原因", " reasons"],
  ["原因：", "Reason: "],
  ["当前还没有举报记录。", "No reports yet."],
  ["黑名单", "Blocklist"],
  ["解除拉黑", "Unblock"],
  ["黑名单目前为空。", "Your blocklist is empty."],
  ["管理看板", "Admin overview"],
  ["待处理 ", "Pending "],
  [" 条", ""],
  ["演示模式", "Admin"],
  ["待审举报", "Pending reports"],
  ["剧情房", "Story rooms"],
  ["最近操作", "Recent actions"],
  ["当前还没有审计事件。", "No audit events yet."],
  ["来源：", "Source: "],
  ["驳回", "Dismiss"],
  ["确认", "Confirm"],
  ["当前没有待处理举报。", "No pending reports right now."],
  ["当前账号没有管理权限", "This account does not have admin access"],
  ["普通用户不会加载审核队列和管理统计，页面会自动降级到个人资料和安全管理视图。", "Regular accounts do not load moderation queues or admin stats. This screen falls back to profile and safety tools automatically."],
  ["边界设置已更新", "Boundaries updated"],
  ["昵称和城市不能为空", "Nickname and city are required"],
  ["资料已更新", "Profile updated"],
  ["已退出登录", "Signed out"],
  ["已解除拉黑", "User unblocked"],
  ["举报已确认", "Report confirmed"],
  ["举报已驳回", "Report dismissed"],
  ["你最想被怎样喜欢", "Which crypto sector are you into most right now?"],
  ["用一句话说出：你最想被怎样喜欢。", "Choose the crypto sector you follow most closely right now."],
  ["我更想被稳定地记住，被认真听完。", "Layer 1 / Public Chains (Ethereum, Solana)"],
  ["比起热烈，我更在意认真和解释感。", "DeFi"],
  ["比起秒回，我更在意对方有没有认真听。", "Layer 2"],
  ["我会因为一个人记住小细节而心动。", "AI"],
  ["希望你不用很会表达，也能让我感到在场。", "I hope you can make me feel your presence, even without saying much."],
  ["你们都偏好稳定聊天节奏，也都把被理解看得很重。", "You both prefer a steady chat pace and care deeply about being understood."],
  ["你们都容易被细节和稳定的在场感打动。", "You both are moved by small details and a steady sense of presence."],
  ["你们都对夜晚氛围和慢节奏靠近有明显偏好。", "You both lean toward night-time atmosphere and slower connection."],
  ["面对一件小误会，你更偏向：", "When a small misunderstanding happens, you usually:"],
  ["当下解释清楚", "Clear it up right away"],
  ["等情绪下去再说", "Wait until emotions settle"],
  ["看情况，不一定讲", "Read the room first"],
  ["刚认识时，你更喜欢哪种聊天节奏？", "When you've just met, which chat rhythm do you prefer?"],
  ["每天都聊一点", "A little every day"],
  ["有内容的时候再聊", "Only when there is something to say"],
  ["留一点距离感", "Keep a little distance"],
  ["第一次见面，你更在意什么？", "On a first meeting, what matters most to you?"],
  ["对方是否守时", "Whether they are on time"],
  ["聊天是否自然", "Whether the conversation feels natural"],
  ["氛围是否放松", "Whether the mood feels relaxed"],
  ["如果关系推进得有点快，你更可能？", "If a relationship moves a little too fast, you're more likely to:"],
  ["直接表达节奏感", "Say your pace directly"],
  ["先观察再决定", "Observe first, decide later"],
  ["顺其自然看看", "Let it unfold naturally"],
  ["你更舒服的聊天节奏是？", "What chat rhythm feels best to you?"],
  ["想到就聊，频率高一点更有安全感", "Talk when it comes to mind. Higher frequency feels safer."],
  ["每天稳定聊一会儿就很好", "A steady chat every day feels right."],
  ["不用高频，但希望关键时刻能出现", "It doesn't need to be frequent, but I want someone to show up when it matters."],
  ["慢一点没关系，重要的是内容有分量", "Slower is fine. What matters is depth."],
  ["如果喜欢一个人，你更可能怎么表达？", "If you like someone, how do you usually show it?"],
  ["直接说出来", "Say it directly"],
  ["先暗示，看对方反应", "Hint first and watch their reaction"],
  ["通过行动表现", "Show it through actions"],
  ["很久以后才敢承认", "Only admit it much later"],
  ["你们都更偏向沟通，只是时机感不同。", "You both lean toward communication, just with different timing."],
  ["那我们对“被在意”的理解可能挺接近。", "Our idea of being cared for might actually be close."],
  ["我不是想逃避，只是更想在情绪稳定时把话说清楚。", "I'm not avoiding it. I just prefer to talk when emotions settle."],
  ["你在剧情房里选“等情绪下去再说”，这点我其实能理解。", "You chose 'wait until emotions settle' in the story room. I actually get that."],
  ["我也会被细节打动。", "I'm moved by small details too."],
  ["我会因为一个人记住小细节而心动，这点你也一样吗？", "I fall for people who remember the little things. Are you like that too?"],
  ["是，我其实会把这种细节看得比热烈表达更重要。", "Yes. I value that kind of detail more than grand expressions."],
  ["我比较慢热，但细节这件事我会记很久。", "I'm slow to warm up, but I remember details for a long time."],
  ["我觉得我们在一些细节上挺接近，想继续了解你。", "I think we align on some small details, and I'd like to know you better."],
  ["安全感", "security"],
  ["陪伴", "companionship"],
  ["细节", "details"],
  ["节奏", "pace"],
  ["理解", "understanding"],
  ["认真", "sincerity"],
  ["稳定", "stability"],
  ["在场", "presence"],
  ["可疑行为", "Suspicious behavior"],
  ["聊天骚扰", "Chat harassment"],
  ["导流风险", "Off-platform risk"],
  ["成人内容", "Sexual content"],
  ["诈骗风险", "Fraud risk"],
  ["其他", "Other"],
  ["高共振", "Strong resonance"],
  ["稳定匹配", "Steady match"],
  ["可探索", "Worth exploring"],
  ["待回应", "Awaiting reply"],
  ["已解锁", "Unlocked"],
  ["优先继续聊天", "Keep chatting first"],
  ["先完成剧情房", "Finish the story room first"],
  ["先等对方处理", "Wait for them first"],
  ["暂时降低优先级", "Lower the priority for now"],
  ["可以主动回应", "You can respond now"],
  ["你们已经完成剧情房，优先回到聊天继续推进关系。", "You've already finished the story room. Go back to chat and keep the connection moving."],
  ["你们已经过了剧情房，下一步价值最大的是把真实对话接起来。", "You've already cleared the story room. The highest-value next step is a real conversation."],
  ["这段关系已经进入剧情房，完成当前互动会比继续刷推荐更值。", "This connection is already in the story room. Finishing it matters more than browsing further right now."],
  ["当前关系已经进入互动阶段，继续刷人不如把这段关系先推进完。", "This connection is already active. It is more valuable to move it forward than keep browsing."],
  ["你已经发出回应，系统先降低重复曝光，等待对方处理这条信号。", "You've already responded, so the system lowers repeat exposure while waiting for the other side."],
  ["这条回应已经送达，系统会暂时降低重复曝光，避免你反复停留在同一个入口。", "This response has been delivered. The system lowers repeat exposure so you don't stay stuck on the same entry point."],
  ["你们的信号风格不同，但仍有值得探索的空间。", "Your signal styles differ, but there is still room worth exploring."],
  ["如果你对这条信号有感觉，现在发起回应是最自然的时机。", "If this signal resonates with you, now is the most natural time to respond."],
  ["你已经跳过一次，除非边界或信号明显变化，这个人会先退到后面。", "You've already skipped once. Unless boundaries or signals change, this person will stay lower in the stack."],
  ["人格重合：当前更依赖信号内容判断", "Persona overlap: currently leaning more on signal content"],
  ["信号共振：当前没有明显重合关键词", "Signal resonance: no strong overlapping keywords yet"],
  ["现实距离：和你同城，见面成本更低", "Distance: same city, easier to meet"],
  ["现实距离：异地，需要更强的节奏匹配", "Distance: long distance, so pace matters more"],
  ["历史反馈：你已跳过 ", "History: you've skipped this person "],
  [" 次，系统会降低曝光。", " times, so the system lowers exposure."],
  ["历史反馈：已经曝光 ", "History: shown "],
  [" 次，排序会逐步衰减。", " times, so ranking gradually cools down."],
  ["人格重合：", "Persona overlap: "],
  ["信号共振：", "Signal resonance: "],
  ["现实距离：", "Distance: "],
  ["你们共享 ", "You share "],
  ["你们既共享 ", "You both share "],
  ["这类关系倾向，推进会更稳定。", "as a relationship tendency, which should make the pace steadier."],
  ["你们在 ", "You are closely aligned on "],
  ["这类相处风格上很接近。", "this style of connection."],
  ["你们最近的信号里，都在意 ", "In your recent signals, you both care about "],
  ["又都在意 ", "and both care about "],
  ["你提交了一次举报", "You submitted a report"],
  ["系统会暂时隐藏这位用户，并等待审核处理。", "This user is hidden for now while the report is reviewed."],
  ["你拉黑了这位用户", "You blocked this user"],
  ["这位用户将从推荐、剧情房和消息列表中隐藏。", "This user will be hidden from recommendations, story rooms, and messages."],
  ["你取消了拉黑", "You removed this block"],
  ["这位用户会重新按当前关系阶段回到系统里。", "This user will reappear based on the current relationship stage."],
  ["你发出了一次回应", "You sent a response"],
  ["关系进入剧情房", "The connection entered the story room"],
  ["系统判断你们已经可以先通过剧情房互动再继续推进。", "The system determined you're ready to interact through the story room before moving further."],
  ["对方接受了你的回应", "The other person accepted your response"],
  ["这段关系已经进入剧情房，可以开始双人互动。", "This connection is now in the story room and ready for paired interaction."],
  ["你们已经完成剧情房，接下来可以进入真实聊天。", "You've finished the story room and can now start a real chat."],
  ["第一次进入你的候选池", "Shown in your candidate pool for the first time"],
  ["系统首次把这位候选人展示给你。", "The system showed you this person for the first time."],
  ["你跳过了这位候选人", "You skipped this person"],
  ["已累计跳过 ", "Skipped "],
  [" 次，系统会降低后续曝光。", " times, so future exposure drops."],
  ["你收藏了这位候选人", "You saved this person"],
  ["系统会保留这段兴趣记录，方便你之后回看。", "The system will keep this interest on record so you can review it later."],
  ["你取消了收藏", "You removed this save"],
  ["这位候选人仍会保留互动记录，但不再被视作重点回看对象。", "This person keeps their interaction history, but is no longer prioritized in review."],
  ["你把这位候选人放回推荐", "You restored this person to recommendations"],
  ["这位候选人已经重新回到推荐流，可以再次考虑是否推进。", "This person is back in the recommendation flow and can be reconsidered."],
  ["已隐藏", "Hidden"],
  ["回看对象", "Review item"],
  ["聊天已解锁，可以开始第一句真实对话。", "Chat is unlocked. You can start the first real conversation."],
  ["内容触发了高风险导流词，当前无法发送。", "This message triggered an off-platform safety risk and can't be sent."],
  ["内容触发了高风险成人词，当前无法发送。", "This message triggered a sexual-content safety risk and can't be sent."],
  ["内容触发了转账或投资风险词，当前无法发送。", "This message triggered a payment or investment safety risk and can't be sent."],
  ["林岚", "Linlan"],
  ["安羽", "Anyu"],
  ["苏绮", "Suqi"]
];

const regexReplacements = [
  [/(\d+)\s*岁/g, "$1 yrs"],
  [/(\d+)\s*\/\s*(\d+)/g, "$1 / $2"],
  [/、/g, ", "],
  [/：/g, ": "],
  [/。/g, "."],
  [/“/g, "\""],
  [/”/g, "\""]
];

const sortedExactTextReplacements = [...exactTextReplacements]
  .sort((left, right) => right[0].length - left[0].length);

export function translateText(content) {
  if (typeof content !== "string" || !content) {
    return content;
  }

  let translated = content;
  sortedExactTextReplacements.forEach(([from, to]) => {
    translated = translated.split(from).join(to);
  });
  regexReplacements.forEach(([pattern, replacement]) => {
    translated = translated.replace(pattern, replacement);
  });
  return translated;
}

export function localizeInterface(root = document.body) {
  if (!root) {
    return;
  }

  const target = root.nodeType === Node.DOCUMENT_NODE ? root.body : root;
  if (!target) {
    return;
  }

  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!/[\u4e00-\u9fff]/.test(node.nodeValue)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    const translated = translateText(node.nodeValue);
    if (translated !== node.nodeValue) {
      node.nodeValue = translated;
    }
  });

  target.querySelectorAll("[placeholder], [title], [aria-label]").forEach((element) => {
    ["placeholder", "title", "aria-label"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (!value) {
        return;
      }
      const translated = translateText(value);
      if (translated !== value) {
        element.setAttribute(attribute, translated);
      }
    });
  });
}

export function $(id) {
  return document.getElementById(id);
}

export function showToast(message) {
  const toast = $("toast");
  toast.textContent = translateText(message);
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 1600);
}

let attentionAction = null;

export function playAttentionSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const now = context.currentTime;
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + index * 0.11);
    gain.gain.exponentialRampToValueAtTime(0.1, now + index * 0.11 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.11 + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + index * 0.11);
    oscillator.stop(now + index * 0.11 + 0.18);
  });
}

export function hideAttentionAlert() {
  const overlay = $("attention-overlay");
  if (!overlay) {
    return;
  }
  overlay.classList.add("hidden");
  attentionAction = null;
}

export function showAttentionAlert({
  eyebrow = "Degen Signal",
  title,
  body,
  ctaLabel = "Open now",
  onAction = null
}) {
  const overlay = $("attention-overlay");
  if (!overlay) {
    return;
  }

  $("attention-eyebrow").textContent = translateText(eyebrow);
  $("attention-title").textContent = translateText(title);
  $("attention-body").textContent = translateText(body);
  $("attention-open-btn").textContent = translateText(ctaLabel);
  $("attention-dismiss-btn").textContent = translateText("Later");
  attentionAction = onAction;
  overlay.classList.remove("hidden");
  playAttentionSound();
}

const attentionOpenButton = $("attention-open-btn");
if (attentionOpenButton) {
  attentionOpenButton.addEventListener("click", () => {
    const callback = attentionAction;
    hideAttentionAlert();
    if (typeof callback === "function") {
      callback();
    }
  });
}

const attentionDismissButton = $("attention-dismiss-btn");
if (attentionDismissButton) {
  attentionDismissButton.addEventListener("click", () => {
    hideAttentionAlert();
  });
}

export function setLoadStatus(message, isError = false, canRetry = false) {
  const node = $("load-status");
  if (!node) {
    return;
  }
  node.textContent = translateText(message);
  node.classList.toggle("hidden", !message);
  node.style.background = isError ? "rgba(255, 142, 142, 0.12)" : "rgba(126, 203, 255, 0.09)";
  const retryButton = $("load-retry-btn");
  if (retryButton) {
    retryButton.classList.toggle("hidden", !canRetry);
    retryButton.textContent = translateText(retryButton.textContent);
  }
}

export function setScreen(id) {
  state.currentScreen = id;
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === id);
  });
  localizeInterface($(id));
}

export function setPanel(panel) {
  state.currentPanel = panel;
  document.querySelectorAll(".panel").forEach((node) => {
    node.classList.toggle("hidden", node.id !== `panel-${panel}`);
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panel === panel);
  });
  const [title, meta] = titleMap[panel];
  $("app-title").textContent = title;
  $("app-meta").textContent = meta;
  localizeInterface($(`panel-${panel}`));
}

export function updateTabBadges(counts = {}) {
  [
    ["home", counts.home || 0],
    ["explore", counts.explore || 0],
    ["story", counts.story || 0],
    ["messages", counts.messages || 0],
    ["me", counts.me || 0]
  ].forEach(([key, value]) => {
    const node = $(`tab-badge-${key}`);
    if (!node) {
      return;
    }
    node.textContent = value > 9 ? "9+" : String(value);
    node.classList.toggle("hidden", !value);
  });
}
