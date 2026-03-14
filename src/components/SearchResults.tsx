import svgPaths from "../imports/svg-s04gq19zek";
import { useState, useEffect, useRef, useCallback } from "react";
import { Tab } from "./Tab";
import { RecordingCard } from "./RecordingCard";
import { RecordingDetail } from "./RecordingDetail";
import { fetchSearchResults, fetchRecord, fetchDomain, CONFIG, getRowObject, StorageUtil } from "@digital-assistant/core";
import { useAuth } from "../contexts/AuthContext";

// Define interface for recording data
interface Recording {
  id: string; // Ensure this matches API response
  status: string;
  name: string;
  // Add other properties as needed based on API response
}

// Define props interface
interface SearchResultsProps {
  searchKeyword?: string;
}

export function SearchResults({ searchKeyword = "" }: SearchResultsProps) {
  const { isAuthenticated, isInitialized } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "trending" | "popular" | "latest"
  >("trending");

  // Initialize selectedRecording from local storage if available
  const [selectedRecording, setSelectedRecording] = useState<any | null>(() => {
    const stored = StorageUtil.getFromStore(CONFIG.SELECTED_RECORDING, false);
    // Check if stored value is a valid object and not empty
    return (stored && Object.keys(stored).length > 0) ? stored : null;
  });

  // Data state
  const [searchResults, setSearchResults] = useState<Recording[]>([]);
  const [page, setPage] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Debounce search keyword
  const [debouncedKeyword, setDebouncedKeyword] = useState(searchKeyword);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(searchKeyword);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  const loadingRef = useRef(false);

  // SDK Subscription to keep selectedRecording in sync during playback
  useEffect(() => {
    // Import SDK dynamically if not already available (though it is imported at top)
    const { coreSDK: DigitalAssistantCoreSDK } = require("../services/coreSDK");
    const unsubscribe = DigitalAssistantCoreSDK.subscribe((newState: any) => {
      const sdkSelected = newState.recording?.selectedRecordingDetails;
      if (sdkSelected && sdkSelected.id === selectedRecording?.id) {
        // Deep compare/update only if status or details changed
        // But since it's a new ref from storage, simple update should suffice
        setSelectedRecording(sdkSelected);
      }
    });
    return unsubscribe;
  }, [selectedRecording?.id]);

  const getSearchResults = useCallback(async (_page: number = 0, refetch = false) => {
    if (!isInitialized || !isAuthenticated) return;

    // If resetting (page 0 and refetch), or loading a new page
    if (_page === 0 && refetch) {
      setSearchResults([]);
      setHasMorePages(true);
    }

    if (loadingRef.current && !refetch) return;

    loadingRef.current = true;
    setIsLoading(true);

    try {
      let domain = fetchDomain();
      // Assuming fetchSearchResultsSDK signature from App.tsx matches fetchSearchResults here or similar
      // Adjust params as per core package definition
      const response = await fetchSearchResults({
        keyword: debouncedKeyword, // Use debounced keyword
        page: _page,
        domain: encodeURI(domain),
        // Add additional params locally if needed, similar to App.tsx logic
      });

      // App.tsx logic suggests response is an array of recordings
      const newRecordings = response || [];

      if (newRecordings.length > 0) {
        setHasMorePages(newRecordings.length >= CONFIG.enableInfiniteScrollPageLength);

        setSearchResults(prev => {
          if (_page === 0) return newRecordings;
          return [...prev, ...newRecordings];
        });
        setPage(_page);
      } else {
        setHasMorePages(false);
      }
    } catch (error) {
      console.error("Error fetching recordings:", error);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [isAuthenticated, isInitialized, debouncedKeyword]); // Depend on debouncedKeyword directly

  // Handle Deep Linking (URL Query params)
  useEffect(() => {
    const initDeepLink = async () => {
      if (!isAuthenticated || !isInitialized) return;

      const searchParams = new URLSearchParams(window.location.search);
      const sequenceId = searchParams.get(CONFIG.UDA_URL_Param);

      if (sequenceId) {
        try {
          const domain = fetchDomain();
          const record = await fetchRecord({
            id: sequenceId,
            domain: encodeURI(domain)
          });

          if (record) {
            setSelectedRecording(record);
            StorageUtil.setToStore(record, CONFIG.SELECTED_RECORDING, false);
          }
        } catch (e) {
          console.error("Failed to load recording from URL:", e);
        }
      }
    };

    initDeepLink();
  }, [isAuthenticated, isInitialized]);

  // Initial load & Search trigger
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      getSearchResults(0, true);
    }
  }, [getSearchResults, isInitialized, isAuthenticated]); // getSearchResults now depends on debouncedKeyword

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMorePages && !isLoading) {
          getSearchResults(page + 1);
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMorePages, isLoading, page, getSearchResults]);


  // If a recording is selected, show the detail view
  if (selectedRecording) {
    return (
      <RecordingDetail
        data={selectedRecording}
        title={getRowObject(selectedRecording).sequenceName}
        onBack={() => {
          setSelectedRecording(null);
          StorageUtil.setToStore({}, CONFIG.SELECTED_RECORDING, false);
        }}
        onDelete={() => {
          setSelectedRecording(null);
          StorageUtil.setToStore({}, CONFIG.SELECTED_RECORDING, false);
        }}
        refetchSearch={() => {
          getSearchResults(0, true); // reload list after delete
        }}
      />
    );
  }

  return (
    <>
      {/* Tabs */}
      <nav
        className="w-full h-10 flex gap-0 mb-6"
        aria-label="Recording filters"
      >
        <Tab
          label="Trending"
          iconPath={svgPaths.p1e798d80}
          isSelected={activeTab === "trending"}
          onClick={() => setActiveTab("trending")}
        />
        <Tab
          label="Popular"
          iconPath={svgPaths.p104c9d00}
          isSelected={activeTab === "popular"}
          onClick={() => setActiveTab("popular")}
        />
        <Tab
          label="Latest"
          iconPath={svgPaths.pf69a800}
          isSelected={activeTab === "latest"}
          onClick={() => setActiveTab("latest")}
        />
      </nav>

      {/* Recording Cards */}
      <div className="w-full flex flex-col gap-[10px] pb-4">
        {searchResults.map((recording: any) => {
          const { sequenceName } = getRowObject(recording);
          return (
            <RecordingCard
              key={recording.id}
              title={sequenceName || "Untitled Recording"}
              onClick={() => {
                setSelectedRecording(recording);
                StorageUtil.setToStore(recording, CONFIG.SELECTED_RECORDING, false);
              }}
            />
          );
        })}

        {/* Loader / Intersection Target */}
        <div ref={observerTarget} className="h-10 w-full flex justify-center items-center">
          {isLoading && <span className="text-gray-500 text-sm">Loading more...</span>}
        </div>

        {!isLoading && searchResults.length === 0 && (
          <div className="text-center text-gray-500 py-8">No recordings found.</div>
        )}
      </div>
    </>
  );
}