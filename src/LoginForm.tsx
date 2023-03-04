import { useState } from "react";
import styles from './LoginForm.module.css';
import type { Crendentials } from "./types";

type LoginFormProps = {
  onClickLogin: (creds: Crendentials) => void;
};

export const LoginForm: React.FC<LoginFormProps> = ({ onClickLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form>
      <div>
        <input
          type="email"
          placeholder="E-mail Address or Handle"
          onChange={(e) => setEmail(e.target.value)}
        ></input>
      </div>
      <div>
        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        ></input>
      </div>
      <button className={styles.btnLogin} type="button" onClick={() => onClickLogin({ email, password })}>
        Login
      </button>
    </form>
  );
};
