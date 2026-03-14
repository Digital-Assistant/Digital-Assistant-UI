import { TitleBar } from "./TitleBar";
import { PlayerControls } from "./PlayerControls";
import { FeedbackButtons } from "./FeedbackButtons";
import { StepsList, StepData } from "./StepsList";
import { StepForm } from "./StepForm";
import { LabelEditor } from "./LabelEditor";
import { PermissionsPanel } from "./PermissionsPanel";
import { Step } from "./Step";
import { useState, useEffect, useRef } from "react";
import {
  deleteRecording,
  vote,
  startStepEditing,
  cancelStepEditing,
  startValidation,
  markValidationCompleted,
  addNotificationAction,
  StorageUtil,
  recordUserClickData,
  matchNode,
  getCurrentPlayItem,
  updateRecording as updateRecordingService,
  updateRecordClicks,
  updateSequnceIndex as updateSequenceIndexService,
  getObjData,
  getVoteRecord,
  fetchStatuses,
  getClickedNodeLabel,
  isHighlightNode,
  saveStepChanges,
  validateStepNameWithProfanity,
  CONFIG
} from "@digital-assistant/core";
import { getUserId } from "../services/userService";
import { off, on, trigger } from "../util/events";
import { translate } from "../util/translation";
import { removeToolTip } from "../util/addToolTip";
import { addNotification } from "../util/addNotification";
import {
  coreSDK as DigitalAssistantCoreSDK,
} from "../services/coreSDK";
import { UDAConsoleLogger } from "@digital-assistant/core";

// Fix for circular structure error in Core package's matchNode/searchNodes
// The Core implementation uses JSON.stringify for logging, which fails on DOM elements
UDAConsoleLogger.info = (mes: any, level: number = 0) => {
  // Use console.log directly which handles circular references in browser devtools
  // or suppress if needed. Using console.log mimics the safe local behavior.
  if (process.env.NODE_ENV === 'development') {
    console.log(mes);
  }
};

interface RecordingDetailProps {
  title?: string;
  onBack?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  data?: any;
  showLoader?: Function;
  config?: any;
  playHandler?: Function;
  isPlaying?: string;
  cancelHandler?: Function;
  refetchSearch?: Function;
  visible?: boolean;
}

export function RecordingDetail(props: RecordingDetailProps) {
  const { title, onBack, onShare, onDelete, data, showLoader, config, playHandler, isPlaying, cancelHandler, refetchSearch, visible } = props;

  // ... (rest of code) ...

  if (!props.data) return null;
  if (props.visible === false) return null;
  const [selectedRecordingDetails, setSelectedRecordingDetails] = useState<any>(data);
  const [userId, setUserId] = useState<string | null>(null);
  const [playStatus, setPlayStatus] = useState<string>("");
  const [userVote, setUserVote] = useState<any>({ upvote: 0, downvote: 0 });

  // Missing Feature State
  const [isEditingLabels, setIsEditingLabels] = useState(false);
  const [labels, setLabels] = useState<Array<{ label: string, profanity: boolean }>>([]);
  const [advBtnShow, setAdvBtnShow] = useState(false);
  const [tmpPermissionsObj, setTmpPermissionsObj] = useState<any>({});
  const [statusOptions, setStatusOptions] = useState<any[]>([]);

  // SDK State
  const [sdkState, setSdkState] = useState(DigitalAssistantCoreSDK.getState());
  const [editRecording, setEditRecording] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [steps, setSteps] = useState<StepData[]>([]);

  // Initialize data and user
  useEffect(() => {
    (async () => {
      setUserId(await getUserId());
      if (selectedRecordingDetails) {
        let userRecord = await getVoteRecord({ id: selectedRecordingDetails.id });
        if (userRecord) setUserVote(userRecord);
        checkStatus();
      }
    })();
  }, []);

  useEffect(() => {
    if (data && data.id !== selectedRecordingDetails?.id) {
      setSelectedRecordingDetails(data);
    }
  }, [data, selectedRecordingDetails?.id]);

  // SDK Subscription
  useEffect(() => {
    const unsubscribe = DigitalAssistantCoreSDK.subscribe((newState) => {
      setSdkState(newState);
    });
    return unsubscribe;
  }, []);

  const editableStepFormState = sdkState.editableStepForm;
  const editingWorkflow = editableStepFormState?.editingWorkflow;

  useEffect(() => {
    if (editingWorkflow?.isEditing && editableStepFormState?.currentEditingIndex != null) {
      setEditRecording(true);
      setEditingStepIndex(editableStepFormState.currentEditingIndex);
    } else if (!editingWorkflow?.isEditing) {
      setEditingStepIndex(null);
    }
  }, [editingWorkflow?.isEditing, editableStepFormState?.currentEditingIndex]);

  // Sync selectedRecordingDetails from SDK Redux store (Source of Truth during Playback)
  useEffect(() => {
    if (sdkState.recording && sdkState.recording.selectedRecordingDetails) {
      console.log("RecordingDetail: Syncing selectedRecordingDetails from SDK store",
        sdkState.recording.selectedRecordingDetails.userclicknodesSet.map((n: any) => n.status));
      setSelectedRecordingDetails(sdkState.recording.selectedRecordingDetails);
    }
  }, [sdkState.recording?.selectedRecordingDetails]);

  // No longer needed: initialization is handled by PlaybackService in SDK

  useEffect(() => {
    const handleBackNavEvent = () => backNav();
    const handlePauseEvent = () => setPlayStatus('paused');
    const handlePlayStartedEvent = () => setPlayStatus('playing');
    const handlePlayCompletedEvent = () => setPlayStatus('completed');

    on("BackToSearchResults", handleBackNavEvent);
    on("PausePlay", handlePauseEvent);
    on("ContinuePlay", handlePlayStartedEvent);
    on("UDAPlaybackCompleted", handlePlayCompletedEvent);

    return () => {
      off("BackToSearchResults", handleBackNavEvent);
      off("PausePlay", handlePauseEvent);
      off("ContinuePlay", handlePlayStartedEvent);
      off("UDAPlaybackCompleted", handlePlayCompletedEvent);
    };
  }, []);

  // Update steps when data changes
  useEffect(() => {
    console.log("RecordingDetail: Updating steps based on selectedRecordingDetails",
      selectedRecordingDetails.userclicknodesSet.map((n: any) => n.status));
    const newSteps = selectedRecordingDetails.userclicknodesSet.map((node: any) => {
      const objData = getObjData(node.objectdata);
      const meta = objData?.meta ?? {};
      return {
        title: getClickedNodeLabel(node) || meta.label || node.label || "Step",
        delay: meta.slowPlaybackTime,
        type: isHighlightNode(objData) ? "Highlight" : "Link",
        tooltip: meta.tooltipInfo,
        completed: node.status === "completed",
        failed: false,
      };
    });
    setSteps(newSteps);
    checkStatus();
  }, [selectedRecordingDetails]);

  // -- LOGIC HELPER FUNCTIONS --

  const checkStatus = () => {
    let count = 0;
    if (selectedRecordingDetails?.userclicknodesSet) {
      for (let i = 0; i < selectedRecordingDetails.userclicknodesSet.length; i++) {
        if (selectedRecordingDetails.userclicknodesSet[i].status === "completed") {
          count++;
        }
      }
      if (count === selectedRecordingDetails.userclicknodesSet.length) {
        setPlayStatus('completed');
      }
    }
  };

  const updateStatus = async (index: number) => {
    const updatedNodes = selectedRecordingDetails.userclicknodesSet.map((node: any, i: number) => {
      if (i === index) {
        return { ...node, status: "completed" };
      }
      return node;
    });

    const updatedDetails = {
      ...selectedRecordingDetails,
      userclicknodesSet: updatedNodes
    };

    StorageUtil.setToStore(updatedDetails, CONFIG.SELECTED_RECORDING, false);
    setSelectedRecordingDetails(updatedDetails);
  };

  const resetStatus = () => {
    if (!selectedRecordingDetails?.userclicknodesSet) return true;

    const updatedNodes = selectedRecordingDetails.userclicknodesSet.map((node: any) => {
      if (node.status) {
        // Use destructuring to create a new object without 'status'
        // This is safer than 'delete' when working with potentially frozen objects
        const { status, ...nodeWithoutStatus } = node;
        return nodeWithoutStatus;
      }
      return node;
    });

    const updatedRecordingDetails = {
      ...selectedRecordingDetails,
      userclicknodesSet: updatedNodes
    };

    StorageUtil.setToStore(updatedRecordingDetails, CONFIG.SELECTED_RECORDING, false);
    setSelectedRecordingDetails(updatedRecordingDetails);

    if (playStatus !== 'playing') {
      setUserVote({ upvote: 0, downvote: 0 });
    }
    return true;
  };



  // -- HANDLERS --

  const backNav = async (forceRefresh = false, openPanel = true) => {
    recordUserClickData('backToSearchResults', '', selectedRecordingDetails?.id);
    if (openPanel) {
      trigger("openPanel", { action: 'openPanel' });
    }
    resetStatus();
    removeToolTip();
    setEditRecording(false);
    DigitalAssistantCoreSDK.dispatch(cancelStepEditing());
    if (cancelHandler) cancelHandler(forceRefresh);
    if (onBack) onBack(); // Also call prop onBack if strictly needed for UI switch
  };

  const handleShareClick = async () => {
    const recordingId = selectedRecordingDetails?.id || selectedRecordingDetails?._id;

    if (recordingId) {
      const el = document.createElement("input");
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set(CONFIG.UDA_URL_Param, recordingId);

      // Use split logic to preserve hash routes if any (matching legacy behavior)
      const path = window.location.href.split('?')[0];
      const fullUrl = path + '?' + searchParams.toString();

      el.value = fullUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);

      recordUserClickData('shareLink', '', recordingId);
      addNotification(translate('linkCopiedTitle'), translate('linkCopied'), 'success');
      if (onShare) onShare();
    } else {
      console.error("Share failed: Missing recording ID");
      addNotification("Error", "Could not generate share link: Missing ID", "error");
    }
  };

  const handleDeleteClick = async () => {
    if (selectedRecordingDetails?.id) {
      recordUserClickData('delete', '', selectedRecordingDetails.id);
      if (showLoader) showLoader(true);
      await deleteRecording({ id: selectedRecordingDetails.id });
      setTimeout(() => {
        backNav(true);
        if (showLoader) showLoader(false);
        if (refetchSearch) refetchSearch('on'); // refresh list so deleted item disappears
      }, CONFIG.indexInterval);
    }
  };

  // Internal Play Handler to replace missing prop
  const internalPlayHandler = async (status: string) => {
    StorageUtil.setToStore(status, CONFIG.RECORDING_IS_PLAYING, true);
  };

  // Use prop or internal handler
  const handlePlayStatusChange = (status: string) => {
    if (playHandler) {
      playHandler(status);
    } else {
      internalPlayHandler(status);
    }
  };

  const pause = async () => {
    handlePlayStatusChange("off");
    setPlayStatus('paused');
    trigger("PausePlay", { recordingId: selectedRecordingDetails.id });
  };

  const replay = async () => {
    recordUserClickData('replay', '', selectedRecordingDetails.id);
    setPlayStatus('playing');
    if (resetStatus()) {
      trigger("closePanel", { action: 'closePanel' });
      handlePlayStatusChange("on");
      // Trigger SDK orchestration
      trigger("ContinuePlay", { action: 'ContinuePlay' });
    }
  };

  const handleVote = async (type: 'up' | 'down') => {
    if (!selectedRecordingDetails?.id) return;
    let record: any = await vote({ id: selectedRecordingDetails.id }, type);

    const newDetails = { ...selectedRecordingDetails };
    newDetails.upVoteCount = record.upVoteCount;
    newDetails.downVoteCount = record.downVoteCount;
    setSelectedRecordingDetails(newDetails);

    if (type === 'up') {
      setUserVote({ upvote: 1, downvote: 0 });
      recordUserClickData('upVote', '', selectedRecordingDetails.id);
    } else {
      setUserVote({ upvote: 0, downvote: 1 });
      recordUserClickData('downVote', '', selectedRecordingDetails.id);
    }
  };


  const handleTitleChange = (newTitle: string) => {
    console.log("Title changed to:", newTitle);
    // TODO: Implement title update logic (API call) if needed, similar to updateStatusChange or simple update
  };

  // -- EDITING STEPS --

  const storeRecording = async (data: any, enableValidation: boolean = true) => {
    const updatedRecordingDetails = {
      ...selectedRecordingDetails,
      userclicknodesSet: data
    };
    setSelectedRecordingDetails(updatedRecordingDetails);
    StorageUtil.setToStore(updatedRecordingDetails, CONFIG.SELECTED_RECORDING, false);
    if (enableValidation) {
      DigitalAssistantCoreSDK.dispatch(startValidation(selectedRecordingDetails.id));
    }
  };

  // -- EDITING STEPS --

  const handleEditStep = (index: number) => {
    if (selectedRecordingDetails?.userclicknodesSet && index >= 0 && index < selectedRecordingDetails.userclicknodesSet.length) {
      const item = selectedRecordingDetails.userclicknodesSet[index];
      resetStatus();
      setEditingStepIndex(index);
      DigitalAssistantCoreSDK.dispatch(startStepEditing({
        recordingId: selectedRecordingDetails.id,
        index: index,
        stepData: JSON.parse(JSON.stringify(item)) // Deep copy for robust backup
      }));
    }
  };

  const handleValidateStep = (_stepData: any) => {
    if (editingStepIndex !== null && selectedRecordingDetails?.id) {
      resetStatus(); // Clear all step statuses before starting validation playback
      DigitalAssistantCoreSDK.dispatch(startValidation(selectedRecordingDetails.id));
      trigger("closePanel", { action: 'closePanel' });
      handlePlayStatusChange("on");
      // Trigger SDK orchestration
      trigger("ContinuePlay", { action: 'ContinuePlay' });
    }
  };

  const handleSaveEditedStep = async (stepData: {
    title: string;
    delay?: number;
    type?: string;
    tooltip?: string;
    skipDuringPlay?: boolean;
    personalInformation?: boolean;
  }) => {
    if (editingStepIndex !== null && selectedRecordingDetails?.userclicknodesSet) {
      if (showLoader) showLoader(true);
      try {
        const profResult = await validateStepNameWithProfanity(stepData.title, config?.enableProfanity);
        let finalTitle = stepData.title;
        if (profResult.success && profResult.data?.hasProfanity) {
          finalTitle = profResult.data.cleanedValue;
          addNotification("Profanity Detected", "Profanity has been removed from your step name.", "warning");
        }

        const result = await saveStepChanges({
          recordData: selectedRecordingDetails.userclicknodesSet,
          index: editingStepIndex,
          stepEditValue: finalTitle,
          isUpdateMode: true, // This is an update to an existing recording
          tooltipInfo: stepData.tooltip,
          slowPlaybackTime: stepData.delay,
          skipDuringPlay: stepData.skipDuringPlay,
          isPersonal: stepData.personalInformation,
        });

        if (result.success && result.data) {
          const updatedRecording = {
            ...selectedRecordingDetails,
            userclicknodesSet: result.data
          };

          // Synchronize with backend using legacy API sequence
          const editingStep = result.data[editingStepIndex];
          if (editingStep) {
            // Send only essential fields to avoid API failures with large payloads.
            // Ensure both sessionid and usersessionid are passed for API compatibility.
            const modifiedData = {
              id: editingStep.id,
              clickednodename: editingStep.clickednodename,
              objectdata: editingStep.objectdata,
              domain: editingStep.domain,
              urlpath: editingStep.urlpath,
              html5: editingStep.html5,
              clickedpath: editingStep.clickedpath,
              sessionid: userId || selectedRecordingDetails.usersessionid,
              usersessionid: userId || selectedRecordingDetails.usersessionid,
            };
            await updateRecordClicks(modifiedData);
            await updateSequenceIndexService(selectedRecordingDetails.id);
          }

          // Send full update to API to ensure backend compatibility
          await updateRecordingService(updatedRecording);

          setSelectedRecordingDetails(updatedRecording);
          StorageUtil.setToStore(updatedRecording, CONFIG.SELECTED_RECORDING, false);

          // Record this action for analytics
          recordUserClickData('editStep', '', selectedRecordingDetails.id);

          if (refetchSearch) refetchSearch("on");
          DigitalAssistantCoreSDK.dispatch(addNotificationAction({
            title: "Step Saved",
            description: "Step changes have been saved successfully.",
            status: "success"
          }));
        }
      } catch (e) {
        console.error('Error saving step:', e);
        addNotification("Error", "Failed to save step changes.", "error");
      } finally {
        if (showLoader) showLoader(false);
      }

      setEditingStepIndex(null);
      DigitalAssistantCoreSDK.dispatch(cancelStepEditing());
    }
  };

  const handleCancelEdit = () => {
    // Revert local data if we have original data
    if (editingWorkflow?.originalStepData && editableStepFormState?.currentEditingIndex !== null) {
      const originalData = [...selectedRecordingDetails.userclicknodesSet];
      originalData[editableStepFormState.currentEditingIndex] = { ...editingWorkflow.originalStepData };
      storeRecording(originalData, false);
    }
    setEditingStepIndex(null);
    DigitalAssistantCoreSDK.dispatch(cancelStepEditing());
  };

  const handlePlayNode = async (index: number) => {
    if (playStatus === 'playing') return;

    const node = selectedRecordingDetails.userclicknodesSet[index];
    if (!node) return;

    const playItem = {
      index,
      node: node,
      selectedRecordingDetails: selectedRecordingDetails
    };

    trigger("closePanel", { action: 'closePanel' });
    if (await matchNode(playItem)) {
      updateStatus(index);
    } else {
      recordUserClickData('playBackError', '', selectedRecordingDetails.id);
      trigger("openPanel", { action: 'openPanel' });
    }
  };

  const handleReport = (issueType: string, description: string) => {
    console.log("Report submitted:", { issueType, description });
    // Add report submission logic
  };

  const getDisplayName = () => {
    if (!selectedRecordingDetails?.name) return title || "Recording";
    try {
      let names = JSON.parse(selectedRecordingDetails.name);
      if (typeof names[0] === 'object' && 'label' in names[0]) {
        return names[0].label;
      } else {
        return names[0] ? names[0] : 'NA';
      }
    } catch (e) {
      return title || "Recording";
    }
  };


  // -- MISSING FEATURES IMPLEMENTATION --

  const getAllLabels = () => {
    try {
      const names = JSON.parse(selectedRecordingDetails?.name || '[]');
      return Array.isArray(names)
        ? names.map(item => {
          if (typeof item === 'object' && 'label' in item) {
            return item;
          }
          return { label: String(item), profanity: false };
        })
        : [];
    } catch (e) {
      return [];
    }
  };

  const startEditing = () => {
    setLabels(getAllLabels());
    setIsEditingLabels(true);
    setEditRecording(true); // Sync with general edit mode
  };

  const saveLabels = async (newLabels: string[]) => {
    if (showLoader) showLoader(true);
    try {
      // Check each label for profanity if enabled
      const processedLabels = await Promise.all(newLabels.map(async (label) => {
        const result = await validateStepNameWithProfanity(label, config?.enableProfanity);
        if (result.success && result.data?.hasProfanity) {
          addNotification("Profanity Detected", `Profanity removed from label: ${label}`, "warning");
          return { label: result.data.cleanedValue, profanity: true };
        }
        return { label, profanity: false };
      }));

      const updatedDetails = {
        ...selectedRecordingDetails,
        name: JSON.stringify(processedLabels)
      };

      await updateRecordingService(updatedDetails);

      // Update local state and storage
      setSelectedRecordingDetails(updatedDetails);
      StorageUtil.setToStore(updatedDetails, CONFIG.SELECTED_RECORDING, false);
      setIsEditingLabels(false);
      if (refetchSearch) refetchSearch("on");
      addNotification(translate('labelsUpdated'), translate('labelsUpdatedDescription'), 'success');
    } catch (error) {
      addNotification(translate('labelsUpdateError'), translate('labelsUpdateErrorDescription'), 'error');
    } finally {
      if (showLoader) showLoader(false);
    }
  };

  const toggleAdvanced = async () => {
    if (advBtnShow) {
      if (showLoader) showLoader(true);
      try {
        const updatedDetails = {
          ...selectedRecordingDetails,
          additionalParams: tmpPermissionsObj
        };

        await updateRecordingService(updatedDetails);

        // Update local state and storage
        setSelectedRecordingDetails(updatedDetails);
        StorageUtil.setToStore(updatedDetails, CONFIG.SELECTED_RECORDING, false);

        setAdvBtnShow(false);
      } catch (e) {
        console.error("Error updating permissions:", e);
        addNotification("Error", "Failed to update permissions.", "error");
      } finally {
        if (showLoader) showLoader(false);
      }
    } else {
      setAdvBtnShow(true);
    }
  };

  const handlePermissionsChange = (key: string, value: any) => {
    let permissions = { ...tmpPermissionsObj };
    if (permissions[key]) {
      delete permissions[key];
    } else {
      permissions[key] = value;
    }
    setTmpPermissionsObj({ ...permissions });
  };

  const updateStatusChange = async (newStatus: number) => {
    if (showLoader) showLoader(true);
    try {
      let permissions = { ...tmpPermissionsObj };
      permissions.status = newStatus;
      setTmpPermissionsObj({ ...permissions });

      const updatedDetails = {
        ...selectedRecordingDetails,
        additionalParams: permissions
      };

      await updateRecordingService(updatedDetails);

      // Update local state and storage
      setSelectedRecordingDetails(updatedDetails);
      StorageUtil.setToStore(updatedDetails, CONFIG.SELECTED_RECORDING, false);
    } catch (e) {
      console.error("Error updating status:", e);
      addNotification("Error", "Failed to update status.", "error");
    } finally {
      if (showLoader) showLoader(false);
    }
  };

  // Initialize permissions and status options
  useEffect(() => {
    if (selectedRecordingDetails?.additionalParams) {
      setTmpPermissionsObj(selectedRecordingDetails.additionalParams);
    }
    if (config?.enableStatusSelection && selectedRecordingDetails?.usersessionid === userId) {
      fetchStatuses().then(setStatusOptions);
    }
  }, [selectedRecordingDetails, userId, config]);


  if (!props.data) return null; // Or check visibility prop if passed

  return (
    <div className="w-full flex flex-col">
      {/* TitleBar & Label Editor */}
      {!isEditingLabels ? (
        <div className="relative">
          <TitleBar
            title={getDisplayName()}
            onBack={() => backNav(false)}
            onTitleChange={handleTitleChange}
            onShare={handleShareClick}
            onDelete={handleDeleteClick}
          />
          {(config?.enableEditingOfRecordings && selectedRecordingDetails?.usersessionid === userId) && (
            <button
              style={{
                position: 'absolute',
                top: '8px',
                right: '48px',
                padding: '4px 12px',
                backgroundColor: '#f3f4f6', // gray-100
                borderRadius: '4px',
                fontSize: '14px',
                color: '#374151', // gray-700
                fontWeight: 500,
                border: '1px solid #e5e7eb',
                cursor: 'pointer'
              }}
              onClick={startEditing}
            >
              {editRecording ? "Done" : "Edit"}
            </button>
          )}
        </div>
      ) : (
        <LabelEditor
          initialLabels={labels}
          onSave={saveLabels}
          onCancel={() => setIsEditingLabels(false)}
        />
      )}

      {/* Player Controls with Feedback Buttons */}
      <div className="content-stretch flex gap-[10px] items-center px-0 py-[16px] rounded-[4px] w-full">
        <PlayerControls
          status={playStatus as any || 'idle'}
          onPlay={() => {
            trigger("closePanel", { action: 'closePanel' });
            handlePlayStatusChange("on");
            // Trigger SDK orchestration
            trigger("ContinuePlay", { action: 'ContinuePlay' });
          }}
          onPause={pause}
          onReplay={replay}
          onSkipNext={() => {
            // trigger next?
          }}
        />

        <div className="flex-1" />

        <FeedbackButtons
          isLiked={userVote?.upvote === 1}
          isDisliked={userVote?.downvote === 1}
          onLike={() => handleVote('up')}
          onDislike={() => handleVote('down')}
          onReport={handleReport}
        />
      </div>

      {/* Steps Section */}
      <div className="w-full flex flex-col">
        <h3 className="flex flex-col font-['Raleway',sans-serif] font-semibold h-[33px] justify-center leading-[0] text-[20px] mb-4 text-black">
          <p className="leading-[normal]">Steps</p>
        </h3>

        <div className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <div key={index}>
              {editingStepIndex === index ? (
                <StepForm
                  mode="editing"
                  stepNumber={index + 1}
                  title={step.title}
                  delay={step.delay}
                  type={step.type}
                  tooltip={step.tooltip}
                  recordData={selectedRecordingDetails.userclicknodesSet}
                  stepIndex={index}
                  storeRecording={(data) => storeRecording(data, false)}
                  onSave={handleSaveEditedStep}
                  onValidate={handleValidateStep}
                  onCancel={handleCancelEdit}
                  validationCompleted={!!editableStepFormState?.editingWorkflow?.validationCompleted}
                  validationRequired={!!editableStepFormState?.editingWorkflow?.validationRequired}
                  config={config}
                />
              ) : (
                <Step
                  title={step.title}
                  delay={step.delay}
                  completed={step.completed}
                  failed={step.failed}
                  onEdit={() => handleEditStep(index)}
                  onPlay={() => handlePlayNode(index)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status Selection & Permissions */}
      {(config?.enableStatusSelection && selectedRecordingDetails?.usersessionid === userId && editRecording) && (
        <div className="p-4 border-t border-gray-200">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{translate('statusLabel')}</label>
            <select
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={tmpPermissionsObj.status || 1}
              onChange={(e) => updateStatusChange(parseInt(e.target.value))}
            >
              {statusOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
          </div>

          <PermissionsPanel
            config={config}
            permissionsObj={tmpPermissionsObj}
            onPermissionChange={handlePermissionsChange}
            onTimeChange={(val) => setTmpPermissionsObj({ ...tmpPermissionsObj, slowPlaybackTime: val })}
            isOpen={advBtnShow}
            onToggle={toggleAdvanced}
          />
        </div>
      )}
    </div>
  );
}