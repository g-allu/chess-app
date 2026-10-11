import { openDatabase } from "./database";
import {
  getCourse,
  getExercise,
  lessons,
  exercises,
} from "../learning/content";
import type { LearningData } from "../learning/contracts";
import type { ReviewCard } from "../review/contracts";
import { openingCourses } from "../openings/content";
import { branchTeachingCourse } from "../openings/training";

export interface DailyTask {
  kind: "review" | "lesson" | "practice";
  courseId: string;
  contentVersion: number;
  runId: string;
}
export interface DailySession {
  schemaVersion: 1;
  id: string;
  day: string;
  startedAt: string;
  tasks: DailyTask[];
}
export function localDay(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function recommendedLesson(data: LearningData, due: ReviewCard[]) {
  const teaching = due.find((card) => card.needsTeaching);
  return (
    (teaching &&
      [
        ...lessons,
        ...openingCourses.filter((course) => course.kind === "lesson"),
      ].find((lesson) =>
        lesson.steps.some(
          (step) =>
            step.kind === "exercise" && step.exerciseId === teaching.exerciseId,
        ),
      )) ||
    (teaching && branchTeachingCourse(teaching.exerciseId)
      ? getCourse(branchTeachingCourse(teaching!.exerciseId)!)
      : undefined) ||
    lessons.find(
      (lesson) => !data.completions.some((item) => item.courseId === lesson.id),
    ) ||
    lessons[0]
  );
}
export function targetedExercise(data: LearningData, due: ReviewCard[]) {
  const recentMiss = [...data.attempts]
    .filter((item) => ["wrong", "timeout"].includes(item.outcome))
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  return getExercise(
    due[0]?.exerciseId ?? recentMiss?.exerciseId ?? exercises[0].id,
  );
}
export function createDailySession(
  data: LearningData,
  due: ReviewCard[],
  now = Date.now(),
): DailySession {
  const day = localDay(now),
    id = `daily-${day}`;
  const tasks: Omit<DailyTask, "runId" | "contentVersion">[] = [
    ...due.map((card) => ({
      kind: "review" as const,
      courseId: `review-${card.exerciseId}`,
    })),
    { kind: "lesson", courseId: recommendedLesson(data, due).id },
    {
      kind: "practice",
      courseId: `practice-${targetedExercise(data, due).id}`,
    },
  ];
  // Repeated failures return to the explanation before another recall test.
  if (due.some((card) => card.needsTeaching)) {
    const lesson = tasks.splice(
      tasks.findIndex((task) => task.kind === "lesson"),
      1,
    )[0];
    tasks.unshift(lesson);
  }
  return {
    schemaVersion: 1,
    id,
    day,
    startedAt: new Date(now).toISOString(),
    tasks: tasks.map((task, index) => ({
      ...task,
      contentVersion: getCourse(task.courseId).version,
      runId: `${id}:${index}`,
    })),
  };
}
export function validateDailySession(session: DailySession): void {
  if (
    !session ||
    session.schemaVersion !== 1 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(session.day) ||
    session.id !== `daily-${session.day}` ||
    !Number.isFinite(Date.parse(session.startedAt)) ||
    !Array.isArray(session.tasks) ||
    session.tasks.length < 2 ||
    session.tasks.length > exercises.length + 2
  )
    throw new Error("Invalid daily session. Stored data has been preserved.");
  let lessonsCount = 0,
    practiceCount = 0;
  session.tasks.forEach((task, index) => {
    if (
      !task ||
      task.runId !== `${session.id}:${index}` ||
      !["review", "lesson", "practice"].includes(task.kind)
    )
      throw new Error("Invalid saved daily task.");
    const course = getCourse(task.courseId);
    if (task.contentVersion !== course.version)
      throw new Error(
        "Saved daily content version is unavailable. Stored data has been preserved.",
      );
    if (
      (task.kind === "lesson" && course.kind !== "lesson") ||
      (task.kind === "review" && !course.id.startsWith("review-")) ||
      (task.kind === "practice" && !course.id.startsWith("practice-"))
    )
      throw new Error("Unavailable daily task.");
    if (task.kind === "lesson") lessonsCount++;
    if (task.kind === "practice") practiceCount++;
  });
  if (
    lessonsCount !== 1 ||
    practiceCount !== 1 ||
    new Set(session.tasks.map((task) => task.courseId)).size !==
      session.tasks.length
  )
    throw new Error("Invalid daily session tasks.");
}
export async function loadDailySession(
  day = localDay(Date.now()),
): Promise<DailySession | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("dailySessions", "readonly"),
      request = tx.objectStore("dailySessions").get(`daily-${day}`);
    tx.oncomplete = () => {
      try {
        if (request.result) validateDailySession(request.result);
        resolve(request.result);
      } catch (error) {
        reject(error);
      }
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Daily session could not be opened."));
  });
}
/** Keep unfinished plans resumable after midnight, including their exact run IDs. */
export async function loadCurrentDailySession(
  day = localDay(Date.now()),
): Promise<DailySession | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["dailySessions", "learningRuns"], "readonly");
    const sessions = tx.objectStore("dailySessions").getAll(),
      runs = tx.objectStore("learningRuns").getAll();
    tx.oncomplete = () => {
      try {
        const available: DailySession[] = sessions.result;
        available.forEach(validateDailySession);
        const unfinished = available
          .filter(
            (session) =>
              session.day <= day &&
              session.tasks.some(
                (task) =>
                  !runs.result.some(
                    (run: { id: string; completed: boolean }) =>
                      run.id === task.runId && run.completed,
                  ),
              ),
          )
          .sort((a, b) => b.day.localeCompare(a.day))[0];
        resolve(unfinished ?? available.find((session) => session.day === day));
      } catch (error) {
        reject(error);
      }
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Daily session could not be opened."));
  });
}
export async function saveDailySession(
  session: DailySession,
): Promise<DailySession> {
  const snapshot = structuredClone(session);
  validateDailySession(snapshot);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("dailySessions", "readwrite"),
      store = tx.objectStore("dailySessions"),
      request = store.get(snapshot.id);
    let saved = snapshot,
      problem: unknown;
    request.onsuccess = () => {
      try {
        if (request.result) {
          validateDailySession(request.result);
          saved = request.result;
        } else store.add(snapshot);
      } catch (error) {
        problem = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(saved);
    tx.onerror = () => reject(problem ?? tx.error);
    tx.onabort = () =>
      reject(
        problem ??
          tx.error ??
          new Error("Daily session was not saved. Retry to continue."),
      );
  });
}
