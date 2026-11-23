// Every `qa.intake` driver passes the intake contract: the fake, the github driver against
// recorded `gh` output and downloads (spec 3.3, R24), the telegram-mtproto driver against recorded
// MTProto history (R25), and the telegram-bot driver against the library's FakeBotApi with
// recorded updates (R26).
import { runContract } from '../../../src/kernel/testing/index.mts';
import { GithubIntakeDriver } from '../../../src/intake/drivers/intake/github.mts';
import { TelegramBotIntakeDriver } from '../../../src/intake/drivers/intake/telegram-bot.mts';
import { TelegramMtprotoIntakeDriver } from '../../../src/intake/drivers/intake/telegram-mtproto.mts';
import { FakeIntakeDriver } from '../../../src/intake/index.mts';
import { intakeContract, recordedGh, recordedGramJs } from '../../../src/intake/testing/index.mts';
import { botHarness, CHAT, GH_FILE, githubFetch, GRAMJS_FILE, ISSUE_URL, SESSION } from '../../support/intake.mts';

runContract(
  intakeContract({
    ref: '-1001',
    items: 6,
    kinds: ['image', 'video', 'voice'],
    tooLarge: ['tg:fake/105'],
    badRef: { ref: ' ', code: 'qa.intake.ref' },
    since: { id: 103, items: ['104', '105', '106'] },
  }),
  () => new FakeIntakeDriver({ maxBytes: 1024 }),
);

runContract(
  intakeContract({
    ref: ISSUE_URL,
    items: 3,
    kinds: ['image', 'video'],
    tooLarge: ['https://private-user-images.githubusercontent.com/1000/big-video.mp4'],
    badRef: { ref: 'https://github.com/acme-test/widget/pull/5', code: 'qa.intake.github.not-issue' },
  }),
  () => new GithubIntakeDriver({ maxBytes: 200 * 1024 * 1024, gh: recordedGh(GH_FILE), fetch: githubFetch().fetch }),
);

runContract(
  intakeContract({
    ref: CHAT,
    items: 7,
    kinds: ['image', 'video', 'voice'],
    tooLarge: [`tg:${CHAT}/206`],
    badRef: { ref: '-100999', code: 'qa.intake.telegram.read' },
    since: { id: 205, items: ['206', '207', '208'] },
  }),
  () =>
    new TelegramMtprotoIntakeDriver(
      { apiId: '12345', apiHash: 'fixture-api-hash', session: SESSION },
      { maxBytes: 200 * 1024 * 1024, loader: recordedGramJs(GRAMJS_FILE).loader },
    ),
);

runContract(
  intakeContract({
    ref: CHAT,
    items: 6,
    kinds: ['image', 'video', 'voice'],
    tooLarge: [`tg:${CHAT}/305`],
    badRef: { ref: ' ', code: 'qa.intake.telegram.chat' },
    since: { id: 303, items: ['304', '305', '306'] },
  }),
  () => {
    const h = botHarness();
    return new TelegramBotIntakeDriver({ token: h.token, apiUrl: h.apiUrl }, { maxBytes: 200 * 1024 * 1024, fetch: h.fetch });
  },
);
