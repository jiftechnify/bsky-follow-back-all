import { AppBskyActorRef, AtpAgent, AtpSessionData } from "@atproto/api";
import { useCallback, useMemo, useState } from "react";
import { FollowerView } from "./Follower";
import { LoginForm } from "./LoginForm";
import type { Crendentials } from "./types";

import styles from "./App.module.css";

type GraphActor = AppBskyActorRef.WithInfo;

const atpAgent = new AtpAgent({ service: "https://bsky.social" });
const bsky = atpAgent.api.app.bsky;

const now = () => new Date().toISOString();

const getFollowers = async (sess: AtpSessionData) => {
  let cursor = "";
  const result: GraphActor[] = [];

  while (true) {
    const resp = await bsky.graph.getFollowers({
      user: sess.handle,
      before: cursor,
    });
    result.push(...resp.data.followers);
    if (!resp.data.cursor || resp.data.followers.length === 0) {
      return result;
    }
    cursor = resp.data.cursor;
  }
};

const getFollowings = async (sess: AtpSessionData) => {
  let cursor = "";
  const result: GraphActor[] = [];

  while (true) {
    const resp = await bsky.graph.getFollows({
      user: sess.handle,
      before: cursor,
    });
    result.push(...resp.data.follows);
    if (!resp.data.cursor || resp.data.follows.length === 0) {
      return result;
    }
    cursor = resp.data.cursor;
  }
};

export const App = () => {
  const [session, setSession] = useState<AtpSessionData | undefined>(undefined);

  const [message, setMessage] = useState("");

  const [followers, setFollowers] = useState<GraphActor[]>([]);
  const [followings, setFollowings] = useState<GraphActor[]>([]);
  const [fetchedFollowers, setFetchedFollwers] = useState(false);
  const [followedBack, setFollowedBack] = useState(false);

  const onClickLogin = async (creds: Crendentials) => {
    setMessage("ログイン中…");

    let sess: AtpSessionData | undefined;
    try {
      const loginResp = await atpAgent.login({
        identifier: creds.email,
        password: creds.password,
      });
      sess = loginResp.data;
      setSession(sess);
    } catch (err) {
      setMessage("ログイン失敗!");
      return;
    }

    setMessage("フォロワーを取得中…");
    const [followersRes, followingsRes] = await Promise.all([
      getFollowers(sess as AtpSessionData),
      getFollowings(sess as AtpSessionData),
    ]);

    setFollowers(followersRes);
    setFollowings(followingsRes);
    setMessage("フォロワー取得完了");
    setFetchedFollwers(true);
  };

  const followingsMap = useMemo(() => {
    return new Map(followings.map((actor) => [actor.did, actor]));
  }, [followings]);

  const notFollowed = useMemo(() => {
    const followersMap = new Map(followers.map((actor) => [actor.did, actor]));
    followings.forEach((followingActor) => {
      followersMap.delete(followingActor.did);
    });
    return Array.from(followersMap.values());
  }, [followers, followings]);

  const followBackAll = useCallback(async () => {
    if (session === undefined) {
      return;
    }

    setMessage("フォローバック中…");
    for (const target of notFollowed) {
      console.log(`following ${target.handle}...`);
      try {
        await bsky.graph.follow.create(
          { did: session.did },
          {
            subject: {
              did: target.did,
              declarationCid: target.declaration.cid,
            },
            createdAt: now(),
          }
        );
        followingsMap.set(target.did, target);
      } catch (err) {
        console.error(err);
      }
    }
    setMessage("フォローバック完了!");
    setFollowedBack(true);
  }, [notFollowed]);

  return (
    <>
      <h1 className={styles.title}>Bluesky Follow Back All</h1>
      <div>
        <div>{message}</div>
        {session === undefined && (
          <LoginForm onClickLogin={onClickLogin}></LoginForm>
        )}
        {notFollowed.length > 0 && !followedBack && (
          <div>
            <div>未フォローバックユーザ数: {notFollowed.length}</div>
            <button
              className={styles.followAll}
              type="button"
              onClick={followBackAll}
            >
              すべてフォロー
            </button>
          </div>
        )}
        {fetchedFollowers && notFollowed.length === 0 && !followedBack && (
          <div>全員フォロー済み🎉</div>
        )}
        <div>
          {followers.map((actor) => (
            <FollowerView
              key={actor.did}
              actor={actor}
              following={followingsMap.has(actor.did)}
            />
          ))}
        </div>
      </div>
    </>
  );
};
