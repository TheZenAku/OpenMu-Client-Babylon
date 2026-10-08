import './style.less';
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { BuildCheck } from '../../../common/buildCheck';
import { mt } from '../../../muidle/text';

/** A newer client is on the server than this page runs (BuildCheck): say so, and offer the reload. */
export const UpdateNotice = observer(() => {
  useEffect(() => BuildCheck.start(), []);
  if (!BuildCheck.stale) return null;

  return (
    <div className="update-notice" role="status">
      <span>{mt('update.ready')}</span>
      <button type="button" onClick={() => location.reload()}>
        {mt('update.reload')}
      </button>
    </div>
  );
});
