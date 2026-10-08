import { useMemo, useState } from "react";
import rawData from "./data/modelData.json";
import { GOOGLE_SHEET_SOURCE } from "./data/googleSheet";
import {
  byOrder,
  findRole,
  findStage,
  getRoleEffect,
  getStageEffect,
  intensityLabel,
  isAffectedStage,
  sourceStatusLabel,
} from "./model";
import type { Distortion, ModelData, RoleId, StageId } from "./types";

const data = rawData as ModelData;

function App() {
  const stages = useMemo(() => byOrder(data.stages), []);
  const [selectedRoleId, setSelectedRoleId] = useState<RoleId>("researcher");
  const [selectedStageId, setSelectedStageId] = useState<StageId>("methodology");
  const [selectedDistortionId, setSelectedDistortionId] = useState("imagined-customer-preference");

  const availableStageIds = useMemo(() => {
    return new Set(
      data.distortions
        .filter((distortion) => distortion.roleId === selectedRoleId)
        .map((distortion) => distortion.stageId),
    );
  }, [selectedRoleId]);

  const matchingDistortions = useMemo(() => {
    return data.distortions.filter(
      (distortion) => distortion.roleId === selectedRoleId && distortion.stageId === selectedStageId,
    );
  }, [selectedRoleId, selectedStageId]);

  const selectedDistortion = useMemo(() => {
    const current = data.distortions.find((distortion) => distortion.id === selectedDistortionId);
    if (current && matchingDistortions.some((distortion) => distortion.id === current.id)) {
      return current;
    }

    return matchingDistortions[0];
  }, [matchingDistortions, selectedDistortionId]);

  function chooseRole(roleId: RoleId) {
    setSelectedRoleId(roleId);
    const next = data.distortions.find((distortion) => distortion.roleId === roleId);
    if (next) {
      setSelectedStageId(next.stageId);
      setSelectedDistortionId(next.id);
    }
  }

  function chooseStage(stageId: StageId) {
    setSelectedStageId(stageId);
    const next = data.distortions.find(
      (distortion) => distortion.roleId === selectedRoleId && distortion.stageId === stageId,
    );
    setSelectedDistortionId(next?.id ?? "");
  }

  function chooseDistortion(distortion: Distortion) {
    setSelectedRoleId(distortion.roleId);
    setSelectedStageId(distortion.stageId);
    setSelectedDistortionId(distortion.id);
  }

  return (
    <main className="app">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Интерактивная модель искажений</p>
            <h1>Как ошибка заражает исследование</h1>
          </div>
          <div className="statusPill">
            <span>{data.distortions.length}</span>
            <span className="statusText">сценариев</span>
            <a href={GOOGLE_SHEET_SOURCE.url} target="_blank" rel="noreferrer">
              таблица данных
            </a>
          </div>
        </header>

        <section className="controls" aria-label="Выбор сценария">
          <div className="controlGroup">
            <span className="controlLabel">Класс</span>
            <div className="segmented">
              {data.roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  aria-pressed={selectedRoleId === role.id}
                  onClick={() => chooseRole(role.id)}
                >
                  {role.title}
                </button>
              ))}
            </div>
          </div>

          <div className="controlGroup stageControl">
            <span className="controlLabel">Среда</span>
            <div className="segmented">
              {stages.map((stage) => (
                (() => {
                  const isAvailable = availableStageIds.has(stage.id);

                  return (
                    <button
                      key={stage.id}
                      type="button"
                      aria-pressed={selectedStageId === stage.id}
                      disabled={!isAvailable}
                      title={isAvailable ? stage.description : "Для выбранного класса здесь пока нет искажений"}
                      onClick={() => chooseStage(stage.id)}
                    >
                      {stage.shortTitle}
                    </button>
                  );
                })()
              ))}
            </div>
          </div>

          <label className="selectLabel">
            Искажение
            <select
              value={selectedDistortion?.id ?? ""}
              disabled={matchingDistortions.length === 0}
              onChange={(event) => {
                const next = data.distortions.find((distortion) => distortion.id === event.target.value);
                if (next) {
                  chooseDistortion(next);
                }
              }}
            >
              {matchingDistortions.length === 0 ? (
                <option value="">Искажений для этой связки пока нет</option>
              ) : (
                matchingDistortions.map((distortion) => (
                  <option key={distortion.id} value={distortion.id}>
                    {distortion.title}
                  </option>
                ))
              )}
            </select>
          </label>
        </section>

        <div className="contentGrid">
          <section className="modelSurface" aria-label="Карта распространения искажения">
            {selectedDistortion ? (
              <ModelMap distortion={selectedDistortion} stages={stages} />
            ) : (
              <EmptySelection selectedRoleId={selectedRoleId} selectedStageId={selectedStageId} />
            )}
          </section>

          <aside className="details" aria-live="polite">
            {selectedDistortion ? (
              <ScenarioDetails distortion={selectedDistortion} stages={stages} />
            ) : (
              <EmptySelection selectedRoleId={selectedRoleId} selectedStageId={selectedStageId} />
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

type EmptySelectionProps = {
  selectedRoleId: RoleId;
  selectedStageId: StageId;
};

function EmptySelection({ selectedRoleId, selectedStageId }: EmptySelectionProps) {
  const role = findRole(data.roles, selectedRoleId);
  const stage = findStage(data.stages, selectedStageId);

  return (
    <div className="emptyState">
      <span className={`roleChip role-${selectedRoleId}`}>{role?.title}</span>
      <span className="stageChip">{stage?.title}</span>
      <h2>Искажений для этой связки пока нет</h2>
      <p>
        В текущей базе Стаси не описаны сценарии для этого класса на выбранной среде. Чтобы не
        смешивать разные этапы, модель не подставляет искажения из других сред.
      </p>
    </div>
  );
}

type ModelMapProps = {
  distortion: Distortion;
  stages: ReturnType<typeof byOrder>;
};

function ModelMap({ distortion, stages }: ModelMapProps) {
  const originRole = findRole(data.roles, distortion.roleId);
  const originStage = findStage(data.stages, distortion.stageId);

  return (
    <div className="map">
      <div className="mapTitleRow">
        <div>
          <h2>Карта среды</h2>
          <p>
            Источник: {originRole?.title}, {originStage?.title.toLowerCase()}
          </p>
        </div>
        <span className="originBadge">{distortion.label}</span>
      </div>

      <div className="stageHeaders">
        <span />
        {stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            className={stage.id === distortion.stageId ? "stageHeader isOrigin" : "stageHeader"}
            data-tooltip={stage.description}
          >
            {stage.title}
          </button>
        ))}
      </div>

      <div className="mapGrid">
        {data.roles.map((role) => (
          <div className="roleRow" key={role.id}>
            <div className={`roleLabel role-${role.id}`}>{role.shortTitle}</div>
            {stages.map((stage) => {
              const isOrigin = role.id === distortion.roleId && stage.id === distortion.stageId;
              const affected = isAffectedStage(distortion, stage.id);
              const stageEffect = getStageEffect(distortion, stage.id);
              const roleEffect = getRoleEffect(distortion, role.id);
              const cellClass = [
                "cell",
                isOrigin ? "isOrigin" : "",
                affected ? "isAffected" : "",
                roleEffect && affected ? "hasRoleEffect" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <article className={cellClass} key={`${role.id}-${stage.id}`}>
                  {isOrigin && <span className="cellToken">{distortion.label}</span>}
                  {affected && <span className="cellStage">{stage.shortTitle}</span>}
                  {stageEffect && role.id === distortion.roleId && (
                    <p>{stageEffect.effect}</p>
                  )}
                  {roleEffect && affected && role.id !== distortion.roleId && (
                    <p>{roleEffect.effect}</p>
                  )}
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

type ScenarioDetailsProps = {
  distortion: Distortion;
  stages: ReturnType<typeof byOrder>;
};

function ScenarioDetails({ distortion, stages }: ScenarioDetailsProps) {
  const role = findRole(data.roles, distortion.roleId);
  const stage = findStage(data.stages, distortion.stageId);

  return (
    <>
      <div className="detailsHeader">
        <span className={`roleChip role-${distortion.roleId}`}>{role?.title}</span>
        <span className="stageChip">{stage?.title}</span>
      </div>

      <h2>{distortion.title}</h2>
      <p className="lead">{distortion.summary}</p>

      <section className="detailBlock">
        <h3>Механизм</h3>
        <p>{distortion.mechanism}</p>
      </section>

      <section className="detailBlock">
        <h3>Цепочка заражения</h3>
        <ol className="effectList">
          {stages
            .map((stageItem) => {
              const effect = getStageEffect(distortion, stageItem.id);
              return effect ? { stage: stageItem, effect } : null;
            })
            .filter(Boolean)
            .map((item) => (
              <li key={item!.stage.id}>
                <span className={`intensity intensity-${item!.effect.intensity}`}>
                  {intensityLabel(item!.effect.intensity)}
                </span>
                <strong>{item!.stage.title}</strong>
                <p>{item!.effect.effect}</p>
              </li>
            ))}
        </ol>
      </section>

      <section className="detailBlock">
        <h3>Последствия по классам</h3>
        <div className="roleEffects">
          {distortion.roleEffects.map((effect) => {
            const effectRole = findRole(data.roles, effect.roleId);
            return (
              <article key={effect.roleId}>
                <span className={`roleDot role-${effect.roleId}`} />
                <div>
                  <strong>{effectRole?.title}</strong>
                  <p>{effect.effect}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="conclusion">
        <h3>Общий вывод</h3>
        <p>{distortion.finalConclusion}</p>
      </section>

      <section className="detailBlock">
        <h3>Источники</h3>
        <ul className="sourceList">
          {distortion.sourceNotes.map((source) => (
            <li key={source.title}>
              <span>{sourceStatusLabel(source.status)}</span>
              {source.title}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default App;
