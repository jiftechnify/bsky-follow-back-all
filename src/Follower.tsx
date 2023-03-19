import { useTranslation } from 'react-i18next';
import type { BskyGraphActor } from "./types";

import styles from "./Follower.module.css";

type FollowerViewProps = {
  actor: BskyGraphActor;
  isFollowing: boolean;
};

export const FollowerView: React.FC<FollowerViewProps> = ({
  actor,
  isFollowing,
}) => {
  const {t} = useTranslation();
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
          {displayName ?? handle}
        </span>
        {displayName && <span className={styles.handle}>{handle}</span>}
        {isFollowing && <span className={styles.following}>{t('text.following')}</span>}
      </div>
    </div>
  );
};
