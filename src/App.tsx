import {ReactRunner} from "@chub-ai/stages-ts";
import {Stage} from "./Stage";
import {TestStageRunner} from "./TestRunner";
import {IS_LOCAL} from "./local/env";
import {LocalRunner} from "./local/LocalRunner";

function App() {
  const isDev = import.meta.env.MODE === 'development';
  console.info(`Running in ${import.meta.env.MODE}`);

  // SPIRE Local (vite --mode standalone) runs on the player's device rather than inside a Chub chat.
  if (IS_LOCAL) return <LocalRunner/>;
  return isDev ? <TestStageRunner factory={ (data: any) => new Stage(data) }/> :
      <ReactRunner factory={(data: any) => new Stage(data)} />;
}

export default App
