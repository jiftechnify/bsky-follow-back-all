import styles from "./Follower.module.css";
import type { BskyGraphActor } from "./types";

type FollowerViewProps = {
  actor: BskyGraphActor;
  following: boolean;
};

export const FollowerView: React.FC<FollowerViewProps> = ({
  actor,
  following,
}) => {
  const { avatar, displayName, handle } = actor;
  return (
    <div className={styles.container}>
      <div className={styles.avatarArea}>
        {avatar && (
          <img
            className={styles.avatar}
            src={avatar}
            width="40"
            height="40"
          ></img>
        )}
      </div>
      <div className={styles.NameArea}>
        <span className={styles.displayName}>{displayName ?? ""}</span>
        <span className={styles.handle}>{handle}</span>
        {following && <span className={styles.following}>フォロー済</span>}
      </div>
    </div>
  );
};
