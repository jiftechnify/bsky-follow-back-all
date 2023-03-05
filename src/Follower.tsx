import styles from "./Follower.module.css";
import type { BskyGraphActor } from "./types";

type FollowerViewProps = {
  actor: BskyGraphActor;
  isFollowing: boolean;
};

export const FollowerView: React.FC<FollowerViewProps> = ({
  actor,
  isFollowing,
}) => {
  const { avatar, displayName, handle } = actor;
  const avatarWrapClass = isFollowing ? styles.avatarWrapFollowing : styles.avatarWrap

  return (
    <div className={styles.container}>
      <div className={styles.avatarArea}>
        <div className={avatarWrapClass}>
          {avatar ? (
            <img className={styles.avatar} src={avatar}></img>
          ) : (
            <div className={styles.avatar} />
          )}
        </div>
      </div>
      <div className={styles.NameArea}>
        <span className={styles.displayName}>
          {displayName ?? `${handle.replaceAll(".bsky.social", "")}`}
        </span>
        <span className={styles.handle}>{handle}</span>
        {isFollowing && <span className={styles.following}>フォロー済</span>}
      </div>
    </div>
  );
};
