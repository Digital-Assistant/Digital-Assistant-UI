import { useState, useEffect } from "react";
import {
  getObjData,
  toggleSkipDuringPlay,
  togglePersonalInfo,
  updateTooltipMetadata,
  updateDelayTimeMetadata,
  updateStepType,
  saveStepChanges,
  updateStepNameService,
  UDAConsoleLogger,
  isHighlightNode,
  fetchHtmlFormElements,
  validateStepNameWithProfanity,
} from "@digital-assistant/core";
import { translate } from "../util/translation";
import { addNotification } from "../util/addNotification";
import svgPaths from "../imports/svg-ckbrelabtn";
import svgPathsNew from "../imports/svg-k4wo7ducks";
import svgPathsMulti from "../imports/svg-xxlbqiqnh7";

interface StepEditorProps {
  onClose: () => void;
  stepNumber: number;
  completedSteps?: Array<{ number: number; title: string }>;
  onSaveStep?: (stepData: any) => void;
  onFinalSave?: (data: { name: string; labels: string[]; additionalParams: any }) => void;
  onCancel?: () => void;
  initialStepData?: {
    title?: string;
    delay?: number;
    type?: string;
    tooltip?: string;
  };
  recordData?: any[];
  stepIndex?: number;
  storeRecording?: (data: any[]) => void;
  // Unified naming props
  sequenceName?: string;
  sequenceLabels?: { label: string; profanity?: boolean }[];
  permissionsConfig?: any;
  tmpPermissions?: any;
  onPermissionsChange?: (key: string, value: any) => void;
  config?: any;
}

export function StepEditor({
  onClose,
  stepNumber,
  completedSteps = [],
  onSaveStep,
  onFinalSave,
  onCancel,
  initialStepData,
  recordData = [],
  stepIndex = 0,
  storeRecording,
  sequenceName = "",
  sequenceLabels = [],
  permissionsConfig,
  tmpPermissions = {},
  onPermissionsChange,
  config = {},
}: StepEditorProps) {
  const [showPermissions, setShowPermissions] = useState(false);
  const [isEditingHome, setIsEditingHome] = useState(false);
  const [selectedType, setSelectedType] = useState(initialStepData?.type || "Link");
  const [tooltipValue, setTooltipValue] = useState(initialStepData?.tooltip || "");
  const [isEditingTooltip, setIsEditingTooltip] = useState(false);
  const [enableSlowReplay, setEnableSlowReplay] = useState(initialStepData?.delay ? true : false);
  const [delaySeconds, setDelaySeconds] = useState(initialStepData?.delay?.toString() || "3");
  const [skipDuringPlay, setSkipDuringPlay] = useState(false);
  const [personalInformation, setPersonalInformation] = useState(false);
  const [showSkipTooltip, setShowSkipTooltip] = useState(false);
  const [showPersonalTooltip, setShowPersonalTooltip] = useState(false);

  // Sequence-level state (unified naming)
  const [localSeqName, setLocalSeqName] = useState(sequenceName);
  const [localLabels, setLocalLabels] = useState(sequenceLabels);
  const [optionsArray, setOptionsArray] = useState<any[]>([]);

  const currentStep = recordData[stepIndex];
  const stepMeta = currentStep ? (getObjData(currentStep.objectdata)?.meta ?? {}) : {};
  const [homeValue, setHomeValue] = useState(stepMeta.displayText || currentStep?.clickednodename || "");

  useEffect(() => {
    if (currentStep) {
      const node = getObjData(currentStep.objectdata);
      const meta = node?.meta ?? {};
      setHomeValue(meta.displayText || currentStep.clickednodename || "");
      setSkipDuringPlay(!!meta.skipDuringPlay);
      setPersonalInformation(!!meta.isPersonal);
      setTooltipValue(meta.tooltipInfo || "");
      if (meta.slowPlaybackTime) {
        setEnableSlowReplay(true);
        setDelaySeconds(String(meta.slowPlaybackTime));
      }

      // Generate options array
      const currentSelectedElement = meta.selectedElement || {
        inputElement: "",
        inputType: "",
        displayName: "Please Select",
        systemTag: "",
      };

      const tempOptionsArray: any[] = [];
      if (currentSelectedElement.inputElement === "") {
        tempOptionsArray.push({
          value: JSON.stringify(currentSelectedElement),
          text: currentSelectedElement.displayName,
        });
      }

      const elements = fetchHtmlFormElements();
      for (const htmlFormElement of elements) {
        tempOptionsArray.push({
          value: JSON.stringify(htmlFormElement),
          text: htmlFormElement.displayName,
        });
      }
      setOptionsArray(tempOptionsArray);

      // Set initial selected value for the dropdown
      const isHighlight = isHighlightNode(node);
      const matchedOption = tempOptionsArray.find(opt => {
        try {
          const val = JSON.parse(opt.value);
          if (isHighlight && val.systemTag === 'highlight') return true;
          if (currentSelectedElement.systemTag && val.systemTag === currentSelectedElement.systemTag) return true;
          if (currentSelectedElement.displayName === val.displayName) return true;
          return false;
        } catch (e) {
          return false;
        }
      });
      if (matchedOption) {
        setSelectedType(matchedOption.value);
      } else if (isHighlight) {
        // Fallback for Highlight if not found in matchedOption
        setSelectedType("Highlight");
      } else {
        setSelectedType("Link");
      }
    }
  }, [stepIndex, recordData.length, currentStep]);

  // Sync sequence-level changes from props
  useEffect(() => setLocalSeqName(sequenceName), [sequenceName]);
  useEffect(() => setLocalLabels(sequenceLabels), [sequenceLabels]);

  const handleSaveHome = async () => {
    const result = await validateStepNameWithProfanity(homeValue, config?.enableProfanity);
    if (!result.success) {
      addNotification("Validation Error", result.error || "Invalid name", "error");
      return;
    }

    let processedValue = homeValue;
    if (result.data?.hasProfanity) {
      processedValue = result.data.cleanedValue;
      setHomeValue(processedValue);
      addNotification("Profanity Detected", "Profanity has been removed from your step name.", "warning");
    }

    setIsEditingHome(false);
    if (storeRecording && recordData.length > 0) {
      const updated = updateStepNameService(recordData, stepIndex, processedValue);
      storeRecording(updated);
    }
  };

  const handleSaveTooltip = () => {
    setIsEditingTooltip(false);
    if (storeRecording && recordData.length > 0) {
      const result = updateTooltipMetadata(recordData, stepIndex, tooltipValue);
      if (result.success && result.data) storeRecording(result.data);
    }
  };

  const handleSaveStep = async () => {
    if (onSaveStep) {
      onSaveStep({
        number: stepNumber,
        title: homeValue,
        type: selectedType,
        tooltip: tooltipValue,
        enableSlowReplay,
        delaySeconds
      });
    }
    const profResult = await validateStepNameWithProfanity(homeValue, config?.enableProfanity);
    let finalHomeValue = homeValue;
    if (profResult.success && profResult.data?.hasProfanity) {
      finalHomeValue = profResult.data.cleanedValue;
      setHomeValue(finalHomeValue);
    }

    if (storeRecording && recordData.length > 0) {
      const result = await saveStepChanges({
        recordData,
        index: stepIndex,
        stepEditValue: finalHomeValue,
        isUpdateMode: false,
        tooltipInfo: tooltipValue,
        slowPlaybackTime: enableSlowReplay ? parseFloat(delaySeconds) : undefined,
        skipDuringPlay,
        isPersonal: personalInformation,
      });
      if (result.success && result.data) {
        storeRecording(result.data);
      }
    }
  };

  const handleFinalAction = () => {
    if (onFinalSave) {
      onFinalSave({
        name: localSeqName,
        labels: localLabels.map(l => l.label).filter(l => l.trim() !== ""),
        additionalParams: tmpPermissions
      });
    }
  };

  const renderActionButtons = () => {
    return (
      <div className="flex gap-[10px] mb-3">
        <button onClick={onCancel} className="flex-1 bg-[#969696] h-[50px] rounded-[8px] font-['Raleway',sans-serif] text-[20px] text-white">Cancel</button>
        <button onClick={handleSaveStep} className="flex-1 bg-black h-[50px] rounded-[8px] font-['Raleway',sans-serif] text-[20px] text-white">Save step</button>
      </div>
    );
  };

  return (
    <div className="bg-[#f2f2f2] rounded-[8px] shadow-[0px_-2px_8px_0px_rgba(0,0,0,0.25),0px_4px_12px_0px_rgba(0,0,0,0.25)] p-3 w-full max-h-[90vh] overflow-y-auto">
      {/* Completed Steps */}
      {completedSteps.length > 0 && (
        <div className="mb-3 space-y-2">
          {completedSteps.map((step) => (
            <div
              key={step.number}
              className="bg-white content-stretch flex gap-[10px] h-[44px] items-center p-[10px] rounded-[8px]"
            >
              <svg className="w-6 h-6 shrink-0" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
                <path d={svgPathsMulti.p2de1ad00} fill="#969696" />
              </svg>
              <div className="flex flex-col font-['Raleway',sans-serif] font-semibold justify-center leading-[0] relative shrink-0 text-[#1c1c1e] text-[20px] text-center text-nowrap">
                <p className="leading-[normal] whitespace-pre">{step.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step Modal (Top) */}
      <div className="bg-[#d5d5d5] rounded-[8px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <p className="font-['Roboto',sans-serif] text-[20px] text-[#1c1c1e] leading-[normal]">Step {stepNumber}</p>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center hover:opacity-80 transition-opacity" aria-label="Close">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
              <path d={svgPaths.p3f2c8580} fill="black" />
            </svg>
          </button>
        </div>

        {/* Home/Title Field */}
        {config.enableEditClickedName && (
          <div className="px-4 mt-2">
            {!isEditingHome ? (
              <div className="relative bg-[#969696] h-[46px] rounded-[8px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] flex items-center px-5">
                <p className="font-['Roboto',sans-serif] text-[20px] text-white tracking-[0.25px] leading-[20px]">
                  {homeValue || (stepNumber === 1 ? "Home" : "Step Title")}
                </p>
                <button onClick={() => setIsEditingHome(true)} className="absolute right-3 w-6 h-6 hover:opacity-80 transition-opacity">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
                    <path d={svgPaths.p157c33f0} fill="white" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="relative bg-white h-[46px] rounded-[8px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] flex items-center pl-3 pr-14">
                <input
                  type="text"
                  value={homeValue}
                  onChange={(e) => setHomeValue(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none font-['Roboto',sans-serif] text-[20px] text-black tracking-[0.25px] leading-[20px]"
                  autoFocus
                />
                <button onClick={handleSaveHome} className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-[30px]">
                  <svg className="block w-9 h-[42px]" fill="none" preserveAspectRatio="none" viewBox="0 0 36 42">
                    <g filter="url(#filter0_dd_home_v2)">
                      <rect fill="black" height="30" rx="4" width="28" x="4" y="4" />
                      <path d="M10 19L15.25 24.25L25.75 13" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
                    </g>
                    <defs>
                      <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="42" id="filter0_dd_home_v2" width="36" x="0" y="0">
                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                        <feColorMatrix in="SourceAlpha" result="hardAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
                        <feOffset dy="4" />
                        <feGaussianBlur stdDeviation="2" />
                        <feComposite in2="hardAlpha" operator="out" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
                        <feBlend in2="BackgroundImageFix" mode="normal" result="effect1_dropShadow_home" />
                        <feBlend in="SourceGraphic" in2="effect1_dropShadow_home" mode="normal" result="shape" />
                      </filter>
                    </defs>
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Properties Section */}
        <div className="px-4 mt-3">
          <h3 className="font-['Raleway',sans-serif] font-semibold text-[20px] text-[#1c1c1e] mb-2.5 leading-[normal]">Properties</h3>

          {/* Checkboxes */}
          <div className="flex items-center gap-6 mb-5">
            {config.enableSkipDuringPlay && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setSkipDuringPlay(!skipDuringPlay);
                    if (storeRecording && recordData.length > 0) storeRecording(toggleSkipDuringPlay(recordData, stepIndex));
                  }}
                  className="w-[22px] h-[22px] border-2 border-black rounded bg-white flex items-center justify-center shrink-0"
                >
                  {skipDuringPlay && <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12"><path d="M2 6L4.5 8.5L10 3" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
                <label className="font-['Jost',sans-serif] text-[14px] text-black">Skip during play</label>
                <div className="relative">
                  <button onMouseEnter={() => setShowSkipTooltip(true)} onMouseLeave={() => setShowSkipTooltip(false)} className="w-[18px] h-[18px]">
                    <svg className="block size-full" fill="none" viewBox="0 0 17 17"><circle cx="8.5" cy="8.5" fill="black" r="8.5" /><path d={svgPathsNew.p1e8c400} fill="white" /></svg>
                  </button>
                  {showSkipTooltip && <div className="absolute top-full left-0 mt-2 bg-black text-white text-[12px] px-3 py-2 rounded-md z-50 w-[200px]">Skip this step during playback</div>}
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setPersonalInformation(!personalInformation);
                  if (storeRecording && recordData.length > 0) storeRecording(togglePersonalInfo(recordData, stepIndex));
                }}
                className="w-[22px] h-[22px] border-2 border-black rounded bg-white flex items-center justify-center shrink-0"
              >
                {personalInformation && <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12"><path d="M2 6L4.5 8.5L10 3" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </button>
              <label className="font-['Jost',sans-serif] text-[14px] text-black">Personal information</label>
              <div className="relative">
                <button onMouseEnter={() => setShowPersonalTooltip(true)} onMouseLeave={() => setShowPersonalTooltip(false)} className="w-[18px] h-[18px]">
                  <svg className="block size-full" fill="none" viewBox="0 0 17 17"><circle cx="8.5" cy="8.5" fill="black" r="8.5" /><path d={svgPathsNew.p1e8c400} fill="white" /></svg>
                </button>
                {showPersonalTooltip && <div className="absolute top-full right-0 mt-2 bg-black text-white text-[12px] px-3 py-2 rounded-md z-50 w-[200px]">This field contains personal information</div>}
              </div>
            </div>
          </div>

          {config.enableNodeTypeSelection && (
            <div className="mb-5">
              <label className="font-['Montserrat',sans-serif] font-medium text-[16px] text-black mb-2 block">Type</label>
              <div className="relative bg-white border border-neutral-300 h-[46px] rounded-[8px] flex items-center px-3">
                <select
                  value={selectedType}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setSelectedType(newValue);

                    let isHighlight = false;
                    try {
                      const parsed = JSON.parse(newValue);
                      if (parsed.systemTag === 'highlight') isHighlight = true;
                    } catch (e) {
                      if (newValue === "Highlight") isHighlight = true;
                    }

                    if (isHighlight) setIsEditingTooltip(true);

                    if (storeRecording && recordData.length > 0) {
                      const updated = updateStepType(recordData, stepIndex, newValue);
                      storeRecording(updated);
                    }
                  }}
                  className="flex-1 bg-transparent border-none outline-none font-['Raleway',sans-serif] text-[14px] text-black appearance-none cursor-pointer"
                >
                  {optionsArray.map((eachOption) => (
                    <option key={eachOption.text} value={eachOption.value}>
                      {eachOption.text}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 w-6 h-6 pointer-events-none">
                  <svg className="block size-full" fill="none" viewBox="0 0 24 24"><path d={svgPathsNew.p37cfbaf0} fill="black" /></svg>
                </div>
              </div>
            </div>
          )}

          {/* Tooltip Input */}
          {config.enableTooltipAddition && (selectedType === "Highlight" || (typeof selectedType === 'string' && selectedType.includes('"systemTag":"highlight"'))) && (
            <div className="mb-5">
              <div className="relative bg-white h-[46px] rounded-[8px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] flex items-center pl-3 pr-14">
                <input type="text" value={tooltipValue} onChange={(e) => setTooltipValue(e.target.value)} placeholder="Custom Tool Tip (optional)" className="flex-1 bg-transparent border-none outline-none font-['Roboto',sans-serif] text-[14px] text-black" />
                <button onClick={handleSaveTooltip} className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-[30px] flex items-center justify-center bg-black rounded">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="white"><path d="M5 13l4 4L19 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </div>
          )}

          {/* Delay Input */}
          {config.enableSlowReplay && (
            <div className="mb-5">
              <input
                type="text"
                placeholder="Delay in seconds (optional)"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value)}
                className="w-full bg-white border border-[#c8c8c8] h-[46px] rounded-[8px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] px-3 font-['Raleway',sans-serif] text-[14px] text-black outline-none"
              />
            </div>
          )}

          {renderActionButtons()}

          <div className="mt-4">
            <button
              onClick={handleFinalAction}
              className="w-full bg-black h-[50px] rounded-[8px] font-['Raleway',sans-serif] text-[20px] text-white hover:opacity-90 transition-opacity"
            >
              Finish Recording
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}