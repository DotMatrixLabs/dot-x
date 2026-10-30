import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const IFACE_XML = `
<node>
  <interface name="org.dotx.ActiveWindow">
    <method name="GetFocusedWindow">
      <arg type="s" direction="out" name="wm_class"/>
      <arg type="s" direction="out" name="title"/>
      <arg type="i" direction="out" name="pid"/>
    </method>
  </interface>
</node>`;

export default class DotxActiveWindowExtension extends Extension {
  enable() {
    this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(IFACE_XML, this);
    this._dbusImpl.export(Gio.DBus.session, '/org/dotx/ActiveWindow');
  }

  disable() {
    this._dbusImpl?.unexport();
    this._dbusImpl = null;
  }

  // D-Bus method, invoked by GNOME Shell via the exported interface above.
  GetFocusedWindow() {
    const win = global.display.focus_window;
    if (!win) return ['', '', 0];
    return [win.get_wm_class() ?? '', win.get_title() ?? '', win.get_pid() ?? 0];
  }
}
