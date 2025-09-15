import Settings from './settings.js';
import Constants from './constants.js';

const settings = new Settings();
const name = Constants.MODULE_NAME;
const triggers = ['On token creation', 'On token deletion'];
const kebabTriggers = triggers.map((t) => t.toLowerCase().replace(/\s+/g, '-'));

/*  Functions */
export function _preUpdateToken(tdoc, changes, options, userId) {
  if (
    (!changes.x && !changes.y) ||
    (changes.x == tdoc.x && changes.y == tdoc.y) ||
    options.animate == false ||
    options.action === 'displace' ||
    options.tokenwarped == true
  )
    return true;
  const isGM = game.users.get(userId).isGM;
  const token = tdoc.object;
  const ev = event;
  const {
    excludedScene,
    movementSpeed,
    movementSwitch,
    outOfBounds,
    debug,
    migration,
    teleportKey,
  } = settings;
  const hasKey = isKeyPressed(ev, teleportKey);

  const destination = { x: changes.x, y: changes.y }; //topLeft
  const origin = { x: tdoc.x, y: tdoc.y }; //topLeft
  const isMoveOutOfBounds =
    outOfBounds && positionOutOfBounds({ destination, origin, tdoc });
  const destinationCenter = token.getCenterPoint(destination);

  const originCenter = token.center;
  if (debug)
    console.warn(`${name} settings: ||`, {
      excludedScene,
      movementSpeed,
      movementSwitch,
      outOfBounds,
      debug,
      migration,
      origin,
      isMoveOutOfBounds,
      destination,
      hasKey,
    });
  const finalDestination = getFinalDestination({ options, id: tdoc.id });
  if (excludedScene || (hasKey && isGM)) {
    if (!hasKey) return getMovementSpeed(options, settings);
    else {
      tdoc.update(finalDestination, {
        animate: false,
        action: 'displace',
        tokenwarped: true,
      });
      return false;
    }
  }

  if (
    (changes.x !== tdoc.x || changes.y !== tdoc.y) &&
    options.animate !== false &&
    options.action !== 'displace' &&
    !options.tokenwarped
  ) {
    if (
      movementSwitch === 'noanimations' ||
      (isGM &&
        movementSwitch === 'wallsblock' &&
        token.checkCollision(destinationCenter, { origin: originCenter }))
    ) {
      options.animate = false;
      options.action = 'displace';
      options.tokenwarped = true;
    }
    if (((isGM && !hasKey) || !isGM) && isMoveOutOfBounds === 'outwards') {
      options.tokenwarped = true;
      options.animate = false;
      options.action = 'displace';
      const { x, y } = clampDestinationToSceneRect({ tdoc, destination });
      foundry.utils.mergeObject(
        options.movement[tdoc.id],
        setLastWayPoint({ options, x, y, id: tdoc.id })
      );
      const newDestination = foundry.utils.duplicate(
        options._movement[tdoc.id].destination
      );
      newDestination.x = x;
      newDestination.y = y;
      options._movement[tdoc.id].destination = newDestination;
      foundry.utils.mergeObject(changes, { x, y }, { inPlace: true });
      options.tokenwarped = true;
    }
    if ((isGM && hasKey) || isMoveOutOfBounds === 'both') {
      options.animate = false;
      options.action = 'displace';
      options.tokenwarped = true;
    }
    return getMovementSpeed(options, settings);
  }
}

function getFinalDestination({ options, id }) {
  const tokenMovementArray = options.movement?.[id]?.waypoints || [];
  return tokenMovementArray[tokenMovementArray.length - 1];
}
function setLastWayPoint({ options, x, y, id }) {
  const tokenMovementArray = foundry.utils.duplicate(
    options.movement?.[id]?.waypoints || []
  );

  if (tokenMovementArray.length > 0) {
    const lastWaypoint = tokenMovementArray[tokenMovementArray.length - 1];
    lastWaypoint.x = x;
    lastWaypoint.y = y;
    lastWaypoint.forced = true;
  }
  return { waypoints: tokenMovementArray };
}

function isKeyPressed(ev, key) {
  const { MODIFIER_CODES: CODES, MODIFIER_KEYS } =
    foundry.helpers?.interaction?.KeyboardManager ?? KeyboardManager;

  /**
   * Track which KeyboardEvent#code presses associate with each modifier.
   * Added support for treating Meta separate from Control.
   * @enum {string[]}
   */
  const MODIFIER_CODES = {
    Alt: CODES.Alt,
    Control: CODES.Control.filter((k) => k.startsWith('Control')),
    Meta: CODES.Control.filter((k) => !k.startsWith('Control')),
    Shift: CODES.Shift,
  };

  function areKeysPressed(event, action) {
    if (!event) return false;
    const activeModifiers = {};
    const addModifiers = (key, pressed) => {
      activeModifiers[key] = pressed;
      MODIFIER_CODES[key].forEach((n) => (activeModifiers[n] = pressed));
    };
    addModifiers(MODIFIER_KEYS.ALT, event.altKey);
    addModifiers(MODIFIER_KEYS.CONTROL, event.ctrlKey);
    addModifiers('Meta', event.metaKey);
    addModifiers(MODIFIER_KEYS.SHIFT, event.shiftKey);
    return game.keybindings.get('tokenwarp', action).some((b) => {
      if (
        game.keyboard.downKeys.has(b.key) &&
        b.modifiers.every((m) => activeModifiers[m])
      )
        return true;
      if (b.modifiers.length) return false;
      return activeModifiers[b.key];
    });
  }
  return key ? areKeysPressed(ev, 'teleportKey') : false; //return false if no proper key is found.
}

function positionOutOfBounds({ destination, origin, tdoc }) {
  //positions top left
  const rect = canvas.scene.dimensions.sceneRect;
  const { h: bottom, w: right } = tdoc.object;
  const destinationOOB =
    rect.x > destination.x ||
    rect.y > destination.y ||
    rect.x + rect.width < destination.x + right ||
    rect.y + rect.height < destination.y + bottom;
  const originOOB =
    rect.x > origin.x ||
    rect.y > origin.y ||
    rect.x + rect.width < origin.x + right ||
    rect.y + rect.height < origin.y + bottom;
  return destinationOOB && originOOB
    ? 'both'
    : destinationOOB && !originOOB
    ? 'outwards'
    : !destinationOOB && originOOB
    ? 'inwards'
    : false;
}

function clampDestinationToSceneRect({ destination, tdoc }) {
  const rect = canvas.scene.dimensions.sceneRect;
  const { h: bottom, w: right } = tdoc.object;
  return {
    x: Math.clamp(destination.x, rect.x, rect.x + rect.width - right),
    y: Math.clamp(destination.y, rect.y, rect.y + rect.height - bottom),
  };
}

function getMovementSpeed(options, settings) {
  if (settings.movementSpeed)
    foundry.utils.setProperty(
      options,
      'animation.movementSpeed',
      settings.movementSpeed
    );
}

async function _renderDialog() {
  const token = this.token; //Token#Document
  const actor = token?.actor || this.actor;
  const twTriggers = actor.getFlag('tokenwarp', 'tokenTriggers') || {};

  let content = '',
    index = 0;

  for (const trigger of triggers) {
    const kebabTrigger = kebabTriggers[index];

    const savedValue = twTriggers[kebabTrigger] || '';
    const placeholder = 'macro uuid';
    content += new foundry.data.fields.StringField({
      label: trigger,
    }).toFormGroup(
      {},
      {
        value: savedValue,
        placeholder,
        name: kebabTrigger,
        dataset: { trigger: kebabTrigger },
      }
    ).outerHTML;
    index++;
  }
  const choices = await foundry.applications.api.DialogV2.prompt({
    content,
    window: { title: name + ' Triggers' },
    position: { width: 400 },
    rejectClose: false,
    ok: {
      callback: (event, button) =>
        new foundry.applications.ux.FormDataExtended(button.form).object,
    },
    render: (event, dialog) => {
      dialog.element
        .querySelectorAll("input[type='text'][data-trigger]")
        .forEach((el) => {
          el.addEventListener('drop', (ev) => _onDrop(ev, el.dataset.trigger));
        });
    },
  });
  if (!choices) return;
  return actor.setFlag('tokenwarp', 'tokenTriggers', choices);
}

function _onDrop(ev) {
  ev.preventDefault();
  const data = foundry.applications.ux.TextEditor.getDragEventData(ev);
  if (data.uuid) ev.target.value = data.uuid; //overwrite
}

// Hooks.on('createToken', tokenwarp._executeOnCreation);
// Hooks.on('preDeleteToken', tokenwarp._executeOnDeletion);
export async function _executeOnCreation(token, context, user) {
  if (game.user.id !== user) return;
  const hasTrigger = token.actor.getFlag(
    'tokenwarp',
    `tokenTriggers.${kebabTriggers[0]}`
  );
  if (hasTrigger) {
    const macro = await fromUuid(hasTrigger);
    return macro.execute({ token, actor: token.actor });
  }
}

export async function _executeOnDeletion(token, context, user) {
  if (game.user.id !== user) return;
  const hasTrigger = token.actor.getFlag(
    'tokenwarp',
    `tokenTriggers.${kebabTriggers[1]}`
  );
  if (hasTrigger) {
    const macro = await fromUuid(hasTrigger);
    return macro.execute({ token, actor: token.actor });
  }
}

export function _addActorSheetHeaderButton(app, controls) {
  controls.push({
    label: `${name} ${game.i18n.localize('TOKENWARP.Triggers')}`,
    icon: 'fas fa-shuffle',
    onClick: _renderDialog.bind({actor: app.document, token: app.token}),
  });
}
