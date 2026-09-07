import { Fragment } from "react";

export default function Phrase({ parts }: { parts: readonly string[] }) {
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${index}-${part}`}>
          {index > 0 && <wbr />}
          <span className="wordUnit">{part}</span>
        </Fragment>
      ))}
    </>
  );
}
