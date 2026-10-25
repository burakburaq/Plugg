import { NOTES_KEY } from "../../modules/newtab-data.js";
import TaskList from "./TaskList.jsx";
export default function QuickNotes() { return <TaskList storageKey={NOTES_KEY} notes />; }
