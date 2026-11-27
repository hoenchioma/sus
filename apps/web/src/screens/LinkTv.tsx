import { useEffect, useState } from 'react';
import { Button, Screen } from '../components/ui';
import { createRoom, formatClock, QuotaError } from '../lib/room';
import { useStored } from '../lib/storage';

/**
 * Where a TV's QR code (or its 4-digit code typed on the home screen) leads. If the TV is already in a
 * room, this joins it; otherwise it starts a room on that TV, and the first to join it hosts.
 */
export function LinkTv({ code }: { code: string }) {
  const [game] = useStored<'mafia' | 'quest'>('sus.homeGame', 'mafia');
  const [problem, setProblem] = useState<{ en: string; bn: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const go = (room: string) => !cancelled && location.replace(`/play/${room}`);
    const fail = (en: string, bn: string) => !cancelled && setProblem({ en, bn });
    const noTv = () => fail(`No TV is showing ${code}. Check the code on the TV.`, `${code} কোডে কোনো টিভি পাওয়া যায়নি। টিভির কোডটি আবার দেখুন।`);

    (async () => {
      try {
        const current = await fetch(`/api/pair/${code}`);
        if (current.status === 404) return noTv();
        const { room } = (await current.json()) as { room: string | null };
        if (room) return go(room);

        const mine = await createRoom(game === 'quest' ? { game: 'quest', skin: 'polashi' } : {});
        const claim = await fetch(`/api/pair/${code}`, { method: 'POST', body: JSON.stringify({ room: mine }) });
        if (claim.status === 404) return noTv();
        // If someone scanned at the same moment and got there first, this lands in their room instead.
        go(((await claim.json()) as { room: string }).room);
      } catch (e) {
        if (e instanceof QuotaError) {
          fail(`Phone games are paused until ${formatClock(e.resetAt)}: today's free server allowance is used up.`, `${formatClock(e.resetAt, 'bn')} পর্যন্ত ফোনে খেলা বন্ধ: আজকের ফ্রি সার্ভারের সীমা শেষ।`);
        } else {
          fail("Couldn't reach the server. Check your connection and try again.", 'সার্ভারে পৌঁছানো গেল না। ইন্টারনেট দেখে আবার চেষ্টা করুন।');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, game]);

  return (
    <Screen className="items-center justify-center text-center">
      <div className="text-5xl">📺</div>
      {problem ? (
        <>
          <p className="mt-4 max-w-sm text-lg font-bold">{problem.en}</p>
          <p className="mt-1 max-w-sm font-bangla text-mist">{problem.bn}</p>
          <Button className="mt-6" onClick={() => location.assign('/')}>
            Home
          </Button>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg font-bold">Joining the TV's game…</p>
          <p className="mt-1 font-bangla text-mist">টিভির খেলায় যোগ দেওয়া হচ্ছে…</p>
          <div className="mt-6 h-10 w-10 animate-spin rounded-full border-4 border-sky border-t-transparent" />
        </>
      )}
    </Screen>
  );
}
