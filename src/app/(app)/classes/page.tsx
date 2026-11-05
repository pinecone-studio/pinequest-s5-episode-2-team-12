import { createClass, joinClass } from '@/features/classes/actions';
import { ClassesView } from '@/features/classes/components/ClassesView';
import { DEMO_CLASS, myClasses } from '@/features/classes/queries';

// Teacher classes: make a class and share its code, or join one (migration 0022).
export default async function ClassesPage() {
  const res = await myClasses();
  // demo mode (no database or a guest): show a sample class so the teacher view can be seen
  const classes = res.ok ? res.data : res.reason === 'demo_mode' ? [DEMO_CLASS] : [];
  return (
    <ClassesView
      classes={classes}
      failure={res.ok ? undefined : res.reason}
      actions={{ createClass, joinClass }}
    />
  );
}
