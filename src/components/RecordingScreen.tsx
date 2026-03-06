/**
 * RecordingScreen.tsx
 *
 * Handles the full recording-capture experience:
 *   - Phase "recording": live list of recorded steps from core SDK storage
 *   - Phase "naming"  : sequence name input, alias labels, permissions, submit
 *   - Phase "saving"  : real upload progress via core SDK API calls
 *
 * All data persistence is delegated entirely to @digital-assistant/core.
 * No custom save logic is written here.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getObjData,
  StorageUtil,
  CONFIG,
  recordClicks,
  postRecordSequenceData,
  profanityCheck,
  hasValidScreenInfo,
  UDAErrorLogger,
  UDAConsoleLogger,
  fetchDomain,
} from "@digital-assistant/core";
import { on, off, trigger } from "../util/events";
import { translate } from "../util/translation";
import { addNotification } from "../util/addNotification";
import { SavingProgress } from "./SavingProgress";
import { StepEditor } from "./StepEditor";

type RecordPhase = "recording" | "naming" | "saving";

interface RecordingScreenProps {
  /** Kept for backward-compat; no longer triggers stepEditor mode */
  onContainerClick?: () => void;
  /** Called when user cancels — navigates HomePageUser back to idle */
  onCancel: () => void;
  /** Called with "cancel" on cancel, or after successful save */
  recordHandler?: Function;
  /** Called after successful save so search results refresh */
  refetchSearch?: Function;
  /** Show/hide a loader in the parent */
  showLoader?: Function;
  /** Global UDA config (enablePermissions, enableSlowReplay, enableProfanity, permissions…) */
  config?: any;
}

export function RecordingScreen({
  onCancel,
  recordHandler,
  refetchSearch,
  showLoader,
  config,
}: RecordingScreenProps) {
  // ── Phase ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<RecordPhase>("recording");

  // ── Recorded data (from core SDK storage) ─────────────────────────────────
  const [recordData, setRecordData] = useState<any[]>([]);

  // ── Naming-phase state ────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [labels, setLabels] = useState<{ label: string; profanity?: boolean }[]>([]);
  const [inputAlert, setInputAlert] = useState<any>({});
  const [inputError, setInputError] = useState<any>({});
  const [inputAt, setInputAt] = useState("");
  const [checkingProfanity, setCheckingProfanity] = useState(false);
  const [formSubmit, setFormSubmit] = useState(false);
  const [disableForm, setDisableForm] = useState(false);

  // ── Permissions ───────────────────────────────────────────────────────────
  const [advBtnShow, setAdvBtnShow] = useState(false);
  const [tmpPermissionsObj, setTmpPermissionsObj] = useState<any>({});

  // ── Slow-replay ───────────────────────────────────────────────────────────
  const [slowPlayback, setSlowPlayback] = useState(false);
  const [delayPlaybackTime, setDelayPlaybackTime] = useState(1);

  // ── Saving-phase state ────────────────────────────────────────────────────
  const [savedClickedDataPercent, setSavedClickedDataPercent] = useState(0);
  const [savingError, setSavingError] = useState(false);

  // ── Screen info validation ────────────────────────────────────────────────
  const [screenInfoNotAvailable, setScreenInfoNotAvailable] = useState(false);

  // ── Load recorded data from core SDK storage ──────────────────────────────
  const loadRecordData = useCallback(() => {
    const stored = StorageUtil.getFromStore(CONFIG.RECORDING_SEQUENCE, false);
    setRecordData(Array.isArray(stored) ? [...stored] : []);
  }, []);

  useEffect(() => {
    loadRecordData();
  }, [loadRecordData]);

  // Listen for "updateRecordedData" — fired by core SDK on every captured click
  useEffect(() => {
    const handler = () => loadRecordData();
    on("updateRecordedData", handler);
    return () => off("updateRecordedData", handler);
  }, [loadRecordData]);

  // Validate screen info on last recorded step
  useEffect(() => {
    if (recordData && recordData.length > 0) {
      const lastNode = getObjData(recordData[recordData.length - 1]?.objectdata);
      if (lastNode?.node?.nodeInfo && !hasValidScreenInfo(lastNode.node.nodeInfo)) {
        setScreenInfoNotAvailable(true);
      } else {
        setScreenInfoNotAvailable(false);
      }
    }
  }, [recordData]);



  // Sync permissions from config
  useEffect(() => {
    if (config?.permissions) {
      setTmpPermissionsObj({ ...config.permissions });
    }
  }, [config]);

  // ── Core SDK storage helper ────────────────────────────────────────────────
  const storeRecording = (data: any[]) => {
    setRecordData([...data]);
    StorageUtil.setToStore(data, CONFIG.RECORDING_SEQUENCE, false);
  };

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const cancelRecording = async () => {
    resetForm();
    StorageUtil.add([], CONFIG.RECORDING_SEQUENCE, false);
    trigger("updateRecordedData", {});
    if (recordHandler) recordHandler("cancel");
    onCancel();
  };

  const resetForm = () => {
    setName("");
    setLabels([]);
    setDisableForm(false);
    setInputAlert({});
    setInputError({});
    setSavedClickedDataPercent(0);
    setSavingError(false);
    setFormSubmit(false);
  };

  // ── Validation helpers ─────────────────────────────────────────────────────
  const validateInput = (value: string): boolean => {
    if (!value || value.length > 100) return false;
    return /^[0-9A-Za-z _.-]+$/.test(value);
  };

  const validateChange = async (value: string) => {
    setName(value);
    if (!validateInput(value)) {
      setInputError((e: any) => ({ ...e, name: true }));
      return false;
    }
    setInputAlert((a: any) => ({ ...a, name: false }));
    setInputError((e: any) => ({ ...e, name: false }));
    return true;
  };

  // ── Profanity helpers (delegate to core SDK) ───────────────────────────────
  const checkProfanity = async (keyword: string): Promise<string> => {
    if (!config?.enableProfanity) return keyword.trim();
    setCheckingProfanity(true);
    try {
      const response: any = await profanityCheck(keyword);
      if (response?.Terms?.length > 0) {
        response.Terms.forEach((term: any) => {
          keyword = keyword.replaceAll(term.Term, "");
        });
      }
    } finally {
      setCheckingProfanity(false);
    }
    return keyword.trim();
  };

  const checkMainLabelProfanity = async (value: string) => {
    if (!value.trim()) return;
    const cleaned = await checkProfanity(value);
    if (value.trim() !== cleaned) {
      setInputAlert((a: any) => ({ ...a, mainLabelProfanity: true }));
    } else {
      setInputAlert((a: any) => ({ ...a, mainLabelProfanity: false }));
    }
    setInputAt("");
    setName(cleaned);
    return validateChange(cleaned);
  };

  const onExtraLabelChange = async (index: number, value: string) => {
    const updatedLabels = [...labels];
    updatedLabels[index] = { ...updatedLabels[index], label: value };
    setLabels(updatedLabels);
    if (!validateInput(value)) {
      setInputError((e: any) => ({ ...e, [`label${index}`]: { error: true } }));
      return false;
    }
    setInputError((e: any) => ({ ...e, [`label${index}`]: { error: false } }));
    return true;
  };

  const checkLabelProfanity = async (index: number, value: string) => {
    if (!value.trim()) return;
    const cleaned = await checkProfanity(value);
    const updatedLabels = [...labels];
    updatedLabels[index] = {
      label: cleaned,
      profanity: value.trim() !== cleaned,
    };
    setLabels(updatedLabels);
    setInputAt("");
    return onExtraLabelChange(index, cleaned);
  };

  // ── Label management ───────────────────────────────────────────────────────
  const addLabel = () => setLabels([...labels, { label: "" }]);

  const removeLabel = (index: number) => {
    const updated = [...labels];
    updated.splice(index, 1);
    setLabels(updated);
  };

  // ── Permissions toggle ─────────────────────────────────────────────────────
  const handlePermissions = (key: string, value: any) => {
    setTmpPermissionsObj((prev: any) => {
      const updated = { ...prev };
      if (updated[key] !== undefined) {
        delete updated[key];
      } else {
        updated[key] = value;
      }
      return updated;
    });
  };

  // ── Validate delay time ────────────────────────────────────────────────────
  const validateDelayTime = (value: number) => {
    if (!isNaN(value)) {
      setDelayPlaybackTime(value);
    } else {
      setInputError((e: any) => ({ ...e, slowPlayBackTime: true }));
    }
  };

  // ── Submit recording (core SDK calls only) ─────────────────────────────────
  const submitRecording = async (overrides?: { name?: string; labels?: string[]; additionalParams?: any }) => {
    setFormSubmit(true);

    const finalName = overrides?.name ?? name;
    const finalLabels = overrides?.labels ?? labels.map(l => l.label);
    const finalParams = overrides?.additionalParams ?? tmpPermissionsObj;

    if (checkingProfanity) {
      addNotification("Wait", "Please wait for profanity check to complete", "warning");
      return;
    }

    if (!finalName || finalName.trim() === "") {
      setInputAlert((a: any) => ({ ...a, name: true }));
      UDAConsoleLogger.info("Submission blocked: Name is empty", 1);
      addNotification("Validation Error", "Sequence name is mandatory.", "error");
      return;
    }
    if (!validateInput(finalName)) {
      setInputError((e: any) => ({ ...e, name: true }));
      UDAConsoleLogger.info("Submission blocked: Name validation failed", 1);
      addNotification("Validation Error", "Sequence name contains invalid characters.", "error");
      return;
    }

    setDisableForm(true);
    setPhase("saving");

    // Build label array: [mainName, ...aliases]
    const labelValues: string[] = [finalName, ...finalLabels];

    const _payload: any = {
      name: JSON.stringify(labelValues),
      domain: fetchDomain(),
      userclicknodesSet: recordData, // Fix visibility: ensure backend sees all nodes
    };

    // Apply status selection
    const mergedParams = { ...finalParams };
    if (global?.UDAGlobalConfig?.enableStatusSelection && !mergedParams.hasOwnProperty("status")) {
      mergedParams.enableStatus = 1;
    }
    if (Object.keys(mergedParams).length > 0) {
      _payload.additionalParams = mergedParams;
    }

    // Save domain if enableForAllDomains
    if (global?.UDAGlobalConfig?.enableForAllDomains) {
      _payload.additionalParams = {
        enableForAllDomains: true,
        recordedDomain: window.location.host,
        ..._payload.additionalParams,
      };
    }

    // Save slow playback time
    if (config?.enableSlowReplay && slowPlayback) {
      _payload.additionalParams = {
        ..._payload.additionalParams,
        slowPlaybackTime: delayPlaybackTime,
      };
    }

    // ── Per-click save loop (SDK: recordClicks) ──────────────────────────────
    const totalClicks = recordData.length + 1;
    let savedClicks = 0;
    let failed = false;

    try {
      for (const [index, clickData] of Object.entries(recordData) as [string, any][]) {
        if (clickData?.id) {
          // Already saved in a previous attempt
          savedClicks++;
          setSavedClickedDataPercent(Math.ceil((savedClicks / totalClicks) * 100));
          continue;
        }
        const resp = await recordClicks(clickData);   // ← core SDK
        if (resp?.id) {
          recordData[parseInt(index)] = resp;
          savedClicks++;
          setSavedClickedDataPercent(Math.ceil((savedClicks / totalClicks) * 100));
        } else {
          UDAErrorLogger.error("Failed to record click: " + JSON.stringify(clickData));
          setSavingError(true);
          failed = true;
          break; // Stop immediately on failure
        }
      }
    } catch (e: any) {
      UDAErrorLogger.error("Exception during recordClicks: " + e?.message);
      setSavingError(true);
      failed = true;
    }

    storeRecording(recordData);

    if (failed) {
      addNotification("Partial Failure", "Some steps failed to save. Please review and try again.", "error");
      setDisableForm(false);
      setPhase("naming");
      return;
    }

    // ── Final sequence save (SDK: postRecordSequenceData) ───────────────────
    try {
      const instance = await postRecordSequenceData(_payload);   // ← core SDK
      if (instance) {
        setSavedClickedDataPercent(Math.ceil(((savedClicks + 1) / totalClicks) * 100));
        addNotification(translate("savedSequence"), translate("savedSequenceDescription"), "success");

        setTimeout(() => {
          if (refetchSearch) refetchSearch("on");
        }, CONFIG.indexInterval);

        StorageUtil.add(false, CONFIG.RECORDING_SWITCH_KEY, true);
        StorageUtil.add([], CONFIG.RECORDING_SEQUENCE, false);
        trigger("updateRecordedData", {});

        if (recordHandler) recordHandler("cancel");
        onCancel();
      } else {
        throw new Error("Failed to save sequence");
      }
    } catch (error) {
      UDAConsoleLogger.info("Save Sequence Error:", error);
      addNotification(translate("savedSequenceError"), translate("savedSequenceErrorDescription"), "error");
      setDisableForm(false);
      setPhase("naming");
      setFormSubmit(false);
    }
  };

  // ── Render step label ──────────────────────────────────────────────────────
  const getStepLabel = (item: any): string => {
    const objData = getObjData(item?.objectdata);
    return objData?.meta?.displayText || item?.clickednodename || "Step";
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: saving
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === "saving") {
    return (
      <div className="content-stretch flex flex-col gap-[20px] items-start w-full">
        {/* Header */}
        <div className="content-stretch flex gap-[10px] items-center relative shrink-0 w-full">
          <div className="relative shrink-0 size-[16px]">
            <svg className="block size-full" fill="none" viewBox="0 0 16 16">
              <circle cx="8" cy="8" fill="#FB2C36" r="8" />
            </svg>
          </div>
          <div className="flex flex-col font-['Raleway',sans-serif] font-semibold justify-center leading-[0] relative shrink-0 text-[#1c1c1e] text-[16px] text-center text-nowrap">
            <p className="leading-[normal] whitespace-pre">Saving Recording…</p>
          </div>
        </div>

        {savingError && (
          <div className="w-full bg-red-50 border border-red-300 text-red-700 rounded-[8px] px-4 py-3 text-sm">
            Some steps failed to save. Please try again.
          </div>
        )}

        {/* Progress — driven by real API progress, not a timer */}
        <div className="w-full flex flex-col items-center justify-center py-8">
          <div className="relative w-[200px] h-[200px]">
            <svg className="absolute inset-0 w-full h-full" fill="none" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" fill="#D9D9D9" />
            </svg>
            <svg className="absolute inset-0 w-full h-full -rotate-90" fill="none" viewBox="0 0 200 200">
              <circle
                cx="100" cy="100" r="80"
                fill="none"
                stroke="black"
                strokeWidth="20"
                strokeDasharray={`${(2 * Math.PI * 80 * savedClickedDataPercent) / 100} ${2 * Math.PI * 80}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.3s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-['Roboto',sans-serif] font-semibold text-[40px] text-black">
                {Math.round(savedClickedDataPercent)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: naming — sequence name + labels + permissions + submit
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === "naming") {
    return (
      <div className="content-stretch flex flex-col gap-[16px] items-start w-full">
        {/* Header */}
        <div className="content-stretch flex gap-[10px] items-center relative shrink-0 w-full">
          <div className="relative shrink-0 size-[16px]">
            <svg className="block size-full" fill="none" viewBox="0 0 16 16">
              <circle cx="8" cy="8" fill="#FB2C36" r="8" />
            </svg>
          </div>
          <p className="font-['Raleway',sans-serif] font-semibold text-[16px] text-[#1c1c1e] leading-[normal] whitespace-pre">
            Save Recording
          </p>
        </div>

        {/* Error alerts */}
        {savingError && (
          <div className="w-full bg-red-50 border border-red-300 text-red-700 rounded-[8px] px-4 py-3 text-sm">
            Some steps failed to save previously. Please retry.
          </div>
        )}
        {screenInfoNotAvailable && (
          <div className="w-full bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-[8px] px-4 py-3 text-sm">
            {translate("screenInfoError")}
          </div>
        )}

        {/* Recorded steps (read-only list) */}
        <ul className="w-full flex flex-col gap-2">
          {recordData.map((item, index) => (
            <li
              key={`step-${index}`}
              className="bg-white content-stretch flex gap-[10px] h-[44px] items-center px-[10px] rounded-[8px] border border-[#e0e0e0]"
            >
              <span className="font-['Raleway',sans-serif] text-[14px] text-[#1c1c1e]">
                {index + 1}. {getStepLabel(item)}
              </span>
            </li>
          ))}
        </ul>

        {/* Slow replay */}
        {config?.enableSlowReplay && (
          <div className="w-full flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-['Jost',sans-serif] text-[14px] text-black">
                {translate("enableDelayTimeText")}
              </span>
              <button
                onClick={() => setSlowPlayback(!slowPlayback)}
                className="h-[16px] w-[32px] flex-shrink-0"
                aria-label="Toggle slow playback"
              >
                <svg className="block size-full" fill="none" viewBox="0 0 32 16">
                  {slowPlayback ? (
                    <>
                      <rect fill="#007AFF" height="16" rx="8" width="32" />
                      <circle cx="24" cy="8" fill="white" r="6" />
                    </>
                  ) : (
                    <>
                      <rect fill="#969696" height="16" rx="8" width="32" />
                      <circle cx="8" cy="8" fill="white" r="6" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            {slowPlayback && (
              <input
                type="number"
                className="w-full bg-white border border-[#c8c8c8] h-[46px] rounded-[8px] px-3 font-['Raleway',sans-serif] text-[14px] text-black outline-none"
                placeholder={translate("delayTimePlaceHolder")}
                value={delayPlaybackTime}
                onChange={(e) => validateDelayTime(Number(e.target.value))}
              />
            )}
          </div>
        )}

        {/* Main label input */}
        <div className="w-full flex flex-col gap-1">
          <input
            type="text"
            id="uda-recorded-name"
            className={`w-full bg-white border ${inputError.name ? "border-red-500" : "border-[#c8c8c8]"
              } h-[46px] rounded-[8px] px-3 font-['Raleway',sans-serif] text-[14px] text-black outline-none`}
            placeholder="Enter Label"
            value={name}
            onChange={async (e) => {
              await validateChange(e.target.value);
              setInputAt("mainLabel");
            }}
            onBlur={async (e) => {
              await checkMainLabelProfanity(e.target.value);
            }}
          />
          {inputAlert.mainLabelProfanity && (
            <span className="text-orange-500 text-[12px]">{translate("profanityDetected")}</span>
          )}
          {inputAlert.name && (
            <span className="text-red-500 text-[12px]">{translate("inputMandatory")}</span>
          )}
          {inputError.name && (
            <span className="text-red-500 text-[12px]">{translate("inputError")}</span>
          )}
        </div>

        {/* Alias labels */}
        <div className="w-full flex flex-col gap-2">
          {labels.map((item, index) => (
            <div key={`label-${index}`} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className={`flex-1 bg-white border ${inputError[`label${index}`]?.error ? "border-red-500" : "border-[#c8c8c8]"
                    } h-[46px] rounded-[8px] px-3 font-['Raleway',sans-serif] text-[14px] text-black outline-none`}
                  placeholder="Enter Alias Label"
                  value={item.label}
                  onChange={async (e) => {
                    await onExtraLabelChange(index, e.target.value);
                    setInputAt(`label${index}`);
                  }}
                  onBlur={async (e) => {
                    await checkLabelProfanity(index, e.target.value);
                  }}
                />
                <button
                  onClick={() => removeLabel(index)}
                  className="w-8 h-8 flex items-center justify-center hover:opacity-70 transition-opacity"
                  aria-label="Remove label"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" stroke="black" strokeLinecap="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>
              {item.profanity && (
                <span className="text-orange-500 text-[12px]">{translate("profanityDetected")}</span>
              )}
              {inputError[`label${index}`]?.error && (
                <span className="text-red-500 text-[12px]">{translate("inputError")}</span>
              )}
            </div>
          ))}
          <button
            onClick={addLabel}
            className="self-start font-['Raleway',sans-serif] text-[14px] text-black underline hover:opacity-70 transition-opacity"
          >
            + {translate("addLabel")}
          </button>
        </div>

        {/* Permissions */}
        {config?.enablePermissions && config?.permissions && (
          <div className="w-full flex flex-col gap-2">
            <button
              onClick={() => setAdvBtnShow(!advBtnShow)}
              className={`${advBtnShow ? "bg-black w-full" : "bg-[#969696] w-[218px]"} h-[40px] rounded-[8px] font-['Raleway',sans-serif] text-[14px] text-white hover:opacity-90 transition-all`}
            >
              {advBtnShow ? translate("hidePermissions") : translate("showPermissions")}
            </button>
            {advBtnShow && (
              <div className="flex flex-col gap-2 pl-2">
                {Object.entries(config.permissions).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={tmpPermissionsObj[key] !== undefined}
                      onChange={() => handlePermissions(key, value)}
                    />
                    <span className="font-['Jost',sans-serif] text-[14px] text-black">
                      {key}: {String(value)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="w-full flex gap-[10px] mt-2">
          <button
            onClick={cancelRecording}
            disabled={disableForm}
            className="flex-1 bg-[#969696] h-[50px] rounded-[8px] font-['Raleway',sans-serif] text-[20px] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {translate("cancelRecording")}
          </button>
          <button
            onClick={() => submitRecording()}
            disabled={disableForm || screenInfoNotAvailable}
            className="flex-1 bg-black h-[50px] rounded-[8px] font-['Raleway',sans-serif] text-[20px] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {translate("submitButton")}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: recording — live step list + last-step editor
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="content-stretch flex flex-col gap-[20px] items-start w-full">
      {/* Recording Started Header */}
      <div className="content-stretch flex gap-[10px] items-center relative shrink-0 w-full">
        <div className="relative shrink-0 size-[16px]">
          <svg className="block size-full" fill="none" viewBox="0 0 16 16">
            <circle cx="8" cy="8" fill="#FB2C36" r="8" />
          </svg>
        </div>
        <div className="flex flex-col font-['Raleway',sans-serif] font-semibold justify-center leading-[0] relative shrink-0 text-[#1c1c1e] text-[16px] text-center text-nowrap">
          <p className="leading-[normal] whitespace-pre">Recording Sequence</p>
        </div>
      </div>

      {/* Steps captured so far */}
      {recordData.length === 0 ? (
        /* Placeholder — SDK will populate this as user clicks around */
        <div
          className="basis-0 bg-[#f2f2f2] content-stretch flex grow items-center justify-center min-h-[300px] relative rounded-[8px] shrink-0 w-full"
        >
          <div aria-hidden="true" className="absolute border border-[#cccccc] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]" />
          <div className="flex flex-col font-['Raleway',sans-serif] font-semibold justify-center leading-[0] relative shrink-0 text-[#1c1c1e] text-[16px] text-center max-w-[296px]">
            <p className="leading-[normal]">Navigate and click through the website to capture steps here</p>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-3">
          {/* Completed steps (all except last) — read-only */}
          {recordData.slice(0, -1).map((item, index) => (
            <div
              key={`step-completed-${index}`}
              className="bg-white content-stretch flex gap-[10px] h-[44px] items-center px-[10px] rounded-[8px] border border-[#e0e0e0]"
            >
              <span className="font-['Raleway',sans-serif] text-[14px] text-[#1c1c1e]">
                {index + 1}. {getStepLabel(item)}
              </span>
            </div>
          ))}

          {/* Last step — shown in StepEditor for properties editing */}
          <StepEditor
            onClose={() => {/* staying in recording phase */ }}
            stepNumber={recordData.length}
            completedSteps={recordData.slice(0, -1).map((item, i) => ({
              number: i + 1,
              title: getStepLabel(item),
            }))}
            recordData={recordData}
            stepIndex={recordData.length - 1}
            storeRecording={storeRecording}
            sequenceName={name}
            sequenceLabels={labels}
            permissionsConfig={config?.permissions}
            tmpPermissions={tmpPermissionsObj}
            onPermissionsChange={handlePermissions}
            enableSlowReplayGlobal={config?.enableSlowReplay}
            onFinalSave={(data) => {
              UDAConsoleLogger.info("Submitting unified recording: " + JSON.stringify(data));
              submitRecording(data);
            }}
            onCancel={cancelRecording}
          />
        </div>
      )}


    </div>
  );
}