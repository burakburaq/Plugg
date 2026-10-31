import { t } from "../../modules/i18n.js";

export default function Settings({ theme, language, onThemeChange, onLanguageChange, error, disabled }) {
  return <section className="tool-content">
    <div className="field">
      <label htmlFor="settings-theme">{t("settings_theme")}</label>
      <select id="settings-theme" value={theme} disabled={disabled} onChange={event => onThemeChange(event.target.value)}>
        <option value="dull">{t("settings_theme_dull")}</option>
        <option value="win8">{t("settings_theme_win8")}</option>
      </select>
    </div>
    <div className="field">
      <label htmlFor="settings-language">{t("settings_language")}</label>
      <select id="settings-language" value={language} disabled={disabled} onChange={event => onLanguageChange(event.target.value)}>
        <option value="en">{t("settings_language_english")}</option>
      </select>
    </div>
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
