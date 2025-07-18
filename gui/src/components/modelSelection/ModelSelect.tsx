import { Listbox } from "@headlessui/react";
import {
  CubeIcon,
  PlusIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import { useContext, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { lightGray, vscEditorBackground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { providers } from "../../pages/AddNewModel/configs/providers";
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";
import { setDefaultModel } from "../../redux/slices/stateSlice";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { RootState } from "../../redux/store";
import {
  getFontSize,
  getMetaKeyLabel,
  isMetaEquivalentKeyPressed,
} from "../../util";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import { DropstoneAuthDialog } from "../dialogs/DropstoneAuthDialog";
import { useDropstoneAuth } from "../../context/DropstoneAuthContext";
import { getCombinedModels, StaticModel, STATIC_DROPSTONE_MODELS } from "../../util/staticModels";

const StyledListboxButton = styled(Listbox.Button)<{ isThinking?: boolean }>`
  border: solid 1px ${props => props.isThinking ? '#1e40af' : `${lightGray}30`};
  background-color: ${props => props.isThinking ? '#1e40af10' : 'transparent'};
  border-radius: 4px;
  padding: 2px 4px;
  margin: 0 2px;
  align-items: center;
  gap: 2px;
	user-select: none;
  cursor: pointer;
  font-size: ${getFontSize() - 3}px;
  font-family: 'Inter', sans-serif;
  color: ${lightGray};
  &:focus {
    outline: none;
  }
`;

const StyledListboxOptions = styled(Listbox.Options) <{ newSession: boolean }>`
  list-style: none;
  padding: 6px;
  white-space: nowrap;
  cursor: default;
  z-index: 50;
  border: 1px solid ${lightGray}30;
  border-radius: 10px;
  background-color: ${vscEditorBackground};
  max-height: 300px;
  overflow-y: auto;
	font-size: ${getFontSize() - 2}px;
	font-family: 'Inter', sans-serif;
	user-select: none;
	outline:none;

  &::-webkit-scrollbar {
    display: none;
  }

  scrollbar-width: none;
  -ms-overflow-style: none;

  & > * {
    margin: 4px 0;
  }
`;

interface ListboxOptionProps {
  isCurrentModel?: boolean;
}

const StyledListboxOption = styled(Listbox.Option) <ListboxOptionProps>`
  cursor: pointer;
  border-radius: 6px;
  padding: 5px 4px;
  font-family: 'Inter', sans-serif;

  &:hover {
    background: ${(props) =>
    props.isCurrentModel ? `${lightGray}66` : `${lightGray}33`};
  }

  background: ${(props) =>
    props.isCurrentModel ? `${lightGray}66` : "transparent"};
`;

const StyledTrashIcon = styled(TrashIcon)`
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 8px;
  &:hover {
    color: red;
  }
`;

const Divider = styled.div`
  height: 2px;
  background-color: ${lightGray}35;
  margin: 0px 4px;
`;

const AuthRequiredOption = styled.div`
  padding: 8px 4px;
  color: ${lightGray};
  font-style: italic;
  font-family: 'Inter', sans-serif;
  border: 1px dashed ${lightGray}30;
  border-radius: 4px;
  margin: 4px 0;
  cursor: pointer;

  &:hover {
    background: ${lightGray}20;
  }
`;

interface Option {
  value: string;
  title: string;
  provider?: string;
  isDefault?: boolean;
  isDropstone?: boolean;
  requiresAuth?: boolean;
  isThinking?: boolean;
}

function modelSelectTitle(model: any): string {
  if (!model) return "";

  let title = model.title || model.model || "";

  if (model.title?.includes("::")) {
    title = model.title.split("::")[1] || title;
  }

  return title;
}

function ModelOption({
  option,
  idx,
  showDelete,
}: {
  option: Option;
  idx: number;
  showDelete?: boolean;
}) {
  const defaultModel = useSelector(defaultModelSelector);
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();
  const [hovered, setHovered] = useState(false);
  const { isLoggedIn: isAuthenticated } = useDropstoneAuth();

  // Check if this option should be disabled
  const isDisabled = option.isDropstone && !isAuthenticated;

  function onClickDelete(e) {
    e.stopPropagation();
    e.preventDefault();

    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title={`Delete ${option.title || 'Unknown Model'}`}
          text={`Are you sure you want to remove ${option.title || 'this model'} from your configuration?`}
          onConfirm={() => {
            ideMessenger.post("config/deleteModel", {
              title: option.title,
            });
          }}
        />,
      ),
    );
  }

  const getModelIcon = () => {
    if (option.isDropstone) {
      return <img
        src={`${window.vscMediaUrl}/logos/dropstone.png`}
        className={`w-3.5 h-3.5 mr-2 flex-none object-contain rounded-sm ${isDisabled ? 'opacity-50' : ''}`}
      />;
    }

    if (option.provider && providers[option.provider]?.icon) {
      return <img
        src={`${window.vscMediaUrl}/logos/${providers[option.provider].icon}`}
        className="w-3.5 h-3.5 mr-2 flex-none object-contain rounded-sm"
      />;
    }

    return <CubeIcon className="w-3.5 h-3.5 stroke-2 mr-2 flex-shrink-0" />;
  };

  return (
    <StyledListboxOption
      key={idx}
      value={option.value || ''}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      isCurrentModel={defaultModel?.title === option.title}
      style={{
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
      onClick={isDisabled ? (e) => {
        e.preventDefault();
        e.stopPropagation();
      } : undefined}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          {getModelIcon()}
          <span style={{ color: isDisabled ? `${lightGray}80` : 'inherit' }}>
            {option.title || 'Unknown Model'}
          </span>
          {/* Show thinking badge for thinking models, otherwise show dropstone badge */}
          {option.isThinking ? (
            <span className="ml-2 text-xs px-1 py-0.5 rounded bg-[#1e40af] text-white">
              Thinking
            </span>
          ) : option.isDropstone && (
            <span className={`ml-2 text-xs px-1 py-0.5 rounded ${
              isDisabled
                ? 'bg-gray-600 text-gray-300'
                : 'bg-blue-600 text-white'
            }`}>
              Dropstone
            </span>
          )}
          {isDisabled && (
            <span className="ml-2 text-xs text-gray-500">
              (Login required)
            </span>
          )}
        </div>
        <StyledTrashIcon
          style={{ visibility: hovered && showDelete && !isDisabled ? "visible" : "hidden" }}
          className="ml-auto"
          width="1.2em"
          height="1.2em"
          onClick={onClickDelete}
        />
      </div>
    </StyledListboxOption>
  );
}

function ModelSelect() {
  const state = useSelector((state: RootState) => state.state);
  const dispatch = useDispatch();
  const defaultModel = useSelector(defaultModelSelector);
  const allModels = useSelector((state: RootState) => state.state.config.models);
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [dropstoneModels, setDropstoneModels] = useState<StaticModel[]>(STATIC_DROPSTONE_MODELS);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const selectedProfileId = useSelector(
    (store: RootState) => store.state.selectedProfileId
  );

  const { isLoggedIn: isAuthenticated, token, authenticate } = useDropstoneAuth();

  /* -----------------------------------------------------------
   * DEBUG: whenever Dropstone authentication changes, print the
   *        current status so we can confirm ModelSelect picks up
   *        the broadcast immediately.
   * ---------------------------------------------------------*/
  useEffect(() => {
    console.log('[ModelSelect] auth change', { isAuthenticated, hasToken: !!token });
  }, [isAuthenticated, token]);

  // Load Dropstone models on mount and when authentication changes
  useEffect(() => {
    const loadDropstoneModels = async () => {
      try {
        const models = await getCombinedModels(token || undefined);
        setDropstoneModels(models);
      } catch (error) {
        console.error('Failed to load Dropstone models:', error);
        // Ensure we always have at least the static models
        setDropstoneModels(STATIC_DROPSTONE_MODELS);
      }
    };

    loadDropstoneModels();
  }, [token, isAuthenticated]);

  useEffect(() => {
    try {
      // Helper function to check if a model is a thinking model
      const isThinkingModel = (title: string) => {
        return title.toLowerCase().includes(':thinking') || title.toLowerCase().endsWith(':thinking');
      };

      // Combine regular models with Dropstone models
      const regularOptions = allModels
        .filter((model) => {
          return (
            model &&
            model.title &&
            !model?.title?.toLowerCase().includes("creator") &&
            !model?.title?.toLowerCase().includes("perplexity") &&
            !model?.title?.toLowerCase().includes("dropstone") &&
            model?.provider !== "pearai_server"
          );
        })
        .map((model) => ({
          value: model.title || '',
          title: modelSelectTitle(model),
          provider: model.provider || '',
          isDefault: model?.isDefault || false,
          isDropstone: false,
          isThinking: isThinkingModel(model.title || ''),
        }));

      // Add Dropstone models
      const dropstoneOptions = dropstoneModels
        .filter(model => model && model.title) // Ensure model and title exist
        .map((model) => ({
          value: model.title || '',
          title: model.title || 'Unknown Dropstone Model',
          provider: model.provider || 'dropstone',
          isDefault: false,
          isDropstone: true,
          requiresAuth: !isAuthenticated,
          isThinking: isThinkingModel(model.title || ''),
        }));

      // Combine options with deduplication
      const combinedOptions = [...regularOptions];

      // Add Dropstone models, avoiding duplicates by title
      dropstoneOptions.forEach(dropstoneOption => {
        const existingOption = combinedOptions.find(option =>
          option.title === dropstoneOption.title ||
          option.value === dropstoneOption.value
        );
        if (!existingOption) {
          combinedOptions.push(dropstoneOption);
        }
      });

      setOptions(combinedOptions);

      // Debug logging to help identify issues
      console.log('Updated model options:', {
        regularOptions: regularOptions.length,
        dropstoneOptions: dropstoneOptions.length,
        total: combinedOptions.length,
        isAuthenticated,
        token: !!token
      });
    } catch (error) {
      console.error('Error updating model options:', error);
      // Fallback to empty options to prevent crashes
      setOptions([]);
    }
  }, [allModels, dropstoneModels, isAuthenticated, token]);

  useEffect(() => {
    const calculatePosition = () => {
      if (!buttonRef.current || !isOpen) return;

      const buttonRect = buttonRef.current.getBoundingClientRect();
      const MENU_WIDTH = 312;
      const MENU_HEIGHT = 320;
      const PADDING = 10;

      let left = Math.max(PADDING, Math.min(
        buttonRect.left,
        window.innerWidth - MENU_WIDTH - PADDING
      ));

      let top = buttonRect.bottom + 5;
      if (top + MENU_HEIGHT > window.innerHeight - PADDING) {
        top = Math.max(PADDING, buttonRect.top - MENU_HEIGHT - 5);
      }

      setMenuPosition({ top, left });
    };

    calculatePosition();

    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "'" && isMetaEquivalentKeyPressed(event)) {
        try {
          const direction = event.shiftKey ? -1 : 1;
          const currentIndex = options.findIndex(
            (option) => option.value === defaultModel?.title
          );

          if (options.length === 0) return; // No options available

          let nextIndex = (currentIndex + 1 * direction) % options.length;
          if (nextIndex < 0) nextIndex = options.length - 1;

          const nextModel = options[nextIndex];
          if (nextModel?.value) {
            dispatch(setDefaultModel({ title: nextModel.value }));
          }
        } catch (error) {
          console.error('Error in keyboard shortcut handler:', error);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options, defaultModel]);

  const handleModelSelect = async (val: string) => {
    try {
      console.log('handleModelSelect called with:', val);
      console.log('Current defaultModel:', defaultModel?.title);
      console.log('Available options:', options.map(o => ({ title: o.title, isDropstone: o.isDropstone })));

      if (!val || val === defaultModel?.title) {
        console.log('Model already selected or invalid value, skipping');
        return;
      }

      // Check if this is a Dropstone model that requires authentication
      const selectedOption = options.find(option => option.value === val);
      console.log('Selected option:', selectedOption);

      if (selectedOption?.isDropstone && !isAuthenticated) {
        console.log('Dropstone model requires authentication, showing auth dialog');
        setShowAuthDialog(true);
        return;
      }

      // If this is a dropstone model, add it to the configuration first
      if (selectedOption?.isDropstone) {
        const dropstoneModel = dropstoneModels.find(model => model.title === val);
        console.log('Found dropstone model:', dropstoneModel);

        if (dropstoneModel) {
          try {
            console.log('Adding dropstone model to configuration...');
            // Check if the model already exists in the configuration
            const existingConfig = await ideMessenger.request("config/getSerializedProfileInfo", undefined);
            const existingModel = existingConfig?.config?.models?.find(m => m.title === dropstoneModel.title);

            if (existingModel) {
              console.log('Model already exists in configuration, skipping');
              return;
            }

            // Add the dropstone model to the configuration
            await ideMessenger.request("config/addModel", {
              model: {
                title: dropstoneModel.title || val,
                provider: "openai", // Use openai provider for OpenAI-compatible API
                model: dropstoneModel.id || val,
                apiBase: "https://server.dropstone.io/v1", // Correct OpenAI-compatible endpoint
                apiKey: token || "dropstone-auth-token", // Use the auth token
                contextLength: 100000, // Default context length for Dropstone models
                systemMessage: "You are an expert software developer. You give helpful and concise responses based on latest documentation and software engineering best practices.",
                requestOptions: {
                  headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                  }
                }
              }
            });

            console.log('Model added successfully, reloading config...');
            // Reload the config to ensure the new model is available
            await ideMessenger.request("config/reload", undefined);
            console.log('Config reloaded successfully');
          } catch (error) {
            console.error('Failed to add Dropstone model to configuration:', error);
            // Show error to user
            dispatch(setShowDialog(true));
            dispatch(
              setDialogMessage(
                <ConfirmationDialog
                  title="Error"
                  text={`Failed to add ${dropstoneModel.title || val} to configuration. Please try again.`}
                  onConfirm={() => {}}
                />,
              ),
            );
            return;
          }
        }
      }

      // Set the model as default
      console.log('Setting model as default:', val);
      dispatch(setDefaultModel({ title: val, force: true }));
    } catch (error) {
      console.error('Error in handleModelSelect:', error);
      // Show error to user
      dispatch(setShowDialog(true));
      dispatch(
        setDialogMessage(
          <ConfirmationDialog
            title="Error"
            text={`Failed to select model. Please try again.`}
            onConfirm={() => {}}
          />,
        ),
      );
    }
  };

  const handleAuthSuccess = async (usernameOrToken: string, password?: string) => {
    const success = await authenticate(usernameOrToken, password);
    if (success) {
      setShowAuthDialog(false);

      try {
        // Reload models after authentication with the new token
        const updatedToken = localStorage.getItem('dropstone_token');
        const models = await getCombinedModels(updatedToken || undefined);
        setDropstoneModels(models);

        // Trigger a config reload to ensure the UI is updated
        await ideMessenger.request("config/reload", undefined);

        console.log('Authentication successful, models reloaded:', models.length);
      } catch (error) {
        console.error('Failed to reload models after authentication:', error);
      }
    }
    return success;
  };

  return (
    <>
      <Listbox
        onChange={handleModelSelect}
        as="div"
        className="flex max-w-[75%]"
      >
        {({ open }) => {
          useEffect(() => {
            setIsOpen(open);
          }, [open]);

          // Check if current model is thinking model
          const isCurrentModelThinking = defaultModel?.title?.toLowerCase().includes(':thinking') ||
                                       defaultModel?.title?.toLowerCase().endsWith(':thinking');

          return (
            <>
              <StyledListboxButton
                ref={buttonRef}
                className="h-[18px] flex overflow-hidden"
                isThinking={isCurrentModelThinking}
              >
                {defaultModel ? (defaultModel?.provider === 'pearai_server' ? (
                  <div className="flex flex-initial items-center">
                    <img
                      src={`${window.vscMediaUrl}/logos/pearai-color.png`}
                      className="w-[15px] h-[15px] object-contain"
                    />
                    {!defaultModel.title?.toLowerCase().includes('pearai') && (
                      <img
                        src={`${window.vscMediaUrl}/logos/${(() => {
                          const modelTitle = (defaultModel.title || '').toLowerCase();
                          switch (true) {
                            case modelTitle.includes('claude'):
                              return 'anthropic.png';
                            case modelTitle.includes('gpt'):
                              return 'openai.png';
                            case modelTitle.includes('deepseek'):
                              return 'deepseek-svg.svg';
                            case modelTitle.includes('gemini'):
                              return 'gemini-icon.png';
                            default:
                              return 'default.png';
                          }
                        })()}`}
                        className="w-[15px] h-[12px] object-contain rounded-sm"
                      />
                    )}
                  </div>
                ) : (
                  defaultModel?.provider && providers[defaultModel.provider]?.icon ? (
                    <img
                      src={`${window.vscMediaUrl}/logos/${providers[defaultModel.provider].icon}`}
                      width="18px"
                      height="18px"
                      style={{
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <CubeIcon className="w-3.5 h-3.5 stroke-2 mr-2 flex-shrink-0" />
                  )
                )) : <CubeIcon className="w-3.5 h-3.5 stroke-2 mr-2 flex-shrink-0" />}
                <span className="truncate inline-block min-w-0">
                  {modelSelectTitle(defaultModel) || "Select model"}{" "}
                </span>
              </StyledListboxButton>

              {open && (
                <StyledListboxOptions
                  newSession={state.history.length === 0}
                  style={{
                    position: 'fixed',
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                  }}
                >
                  {/* Regular Models Section */}
                  {options.filter((option) => !option.isDropstone).length > 0 && (
                    <>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px',
                        fontSize: getFontSize() - 4,
                        color: lightGray,
                        fontWeight: 'bold',
                      }}>
                        Regular Models ({options.filter((option) => !option.isDropstone).length})
                      </div>
                      {options
                        .filter((option) => !option.isDropstone)
                        .map((option, idx) => (
                          <ModelOption
                            key={`regular-${idx}`}
                            option={option}
                            idx={idx}
                            showDelete={true}
                          />
                        ))}
                      <Divider />
                    </>
                  )}

                  {/* Dropstone Models Section */}
                    <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px',
                      fontSize: getFontSize() - 4,
                      color: lightGray,
                    fontWeight: 'bold',
                    }}>
                    Dropstone Models ({dropstoneModels.length})
                    </div>
                    {!isAuthenticated && (
                      <AuthRequiredOption onClick={() => setShowAuthDialog(true)}>
                        🔐 Authenticate to use Dropstone models
                      </AuthRequiredOption>
                    )}
                    {/* Render Dropstone models using the same ModelOption component */}
                    {options
                      .filter((option) => option.isDropstone)
                      .map((option, idx) => (
                        <ModelOption
                          key={`dropstone-${idx}`}
                          option={option}
                          idx={idx}
                          showDelete={false}
                        />
                      ))}
                </StyledListboxOptions>
              )}
            </>
          );
        }}
      </Listbox>

      <DropstoneAuthDialog
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        onAuthenticate={handleAuthSuccess}
      />
    </>
  );
}

export default ModelSelect;
