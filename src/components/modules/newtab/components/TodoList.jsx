import { TODO_KEY } from "../newtab-data.js";
import TaskList from "./TaskList.jsx";
export default function TodoList() { return <TaskList storageKey={TODO_KEY} />; }
