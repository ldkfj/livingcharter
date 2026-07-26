import React from "react";
import { EnvError } from "../config/env";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface EnvGuardProps {
  errors: EnvError[];
}

export const EnvGuardFallback: React.FC<EnvGuardProps> = ({ errors }) => {
  return (
    <div className="env-error-screen" role="alert">
      <div className="env-error-card">
        <div className="env-error-header">
          <ShieldAlert className="icon-warning" size={48} />
          <h1>Configuration Error — App Refuses to Operate</h1>
        </div>

        <p className="env-error-intro">
          LivingCharter requires valid deployed Intelligent Contract addresses configured in your environment before startup.
          Placeholder or missing addresses are strictly rejected.
        </p>

        <div className="env-error-list">
          {errors.map((err) => (
            <div key={err.variable} className="env-error-item">
              <div className="env-error-badge">
                <AlertTriangle size={16} />
                <span>{err.variable}</span>
              </div>
              <div className="env-error-details">
                <p className="env-error-reason">{err.reason}</p>
                <div className="env-error-value">
                  <span>Current Value: </span>
                  <code>{err.value === undefined ? "undefined (missing)" : err.value === "" ? "(empty string)" : err.value}</code>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="env-error-instructions">
          <h3>How to Fix:</h3>
          <ol>
            <li>Create or update the <code>frontend/.env</code> file in your workspace root.</li>
            <li>Define real deployed Studionet contract addresses:
              <pre>
                VITE_CHARTER_ADDRESS=0x0D22C5298ad1437DB715A543B485588a8e0fc9DB{"\n"}
                VITE_TREASURY_ADDRESS=0xB984B0a79B9BC17C332017B0640Dc82eE6151393
              </pre>
            </li>
            <li>Restart the Vite dev server or re-run <code>npm run build</code>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
