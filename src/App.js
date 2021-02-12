import "./App.css";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import CreateRoom from "./routes/CreateRoom";
import Room from "./routes/Room";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Switch>
          <Route path="/" exact component={CreateRoom} />
          <Route path="/room/:roomID" exact component={Room} />
        </Switch>
      </BrowserRouter>
    </div>
  );
}

export default App;
