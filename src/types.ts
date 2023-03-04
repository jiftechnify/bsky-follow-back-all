import type { AppBskyActorRef } from "@atproto/api";

export type Crendentials = {
  email: string;
  password: string;
};

export type BskyGraphActor = AppBskyActorRef.WithInfo;
