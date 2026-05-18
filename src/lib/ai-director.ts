// AI director simplified for the new engine structure
export type DirectorRequest = {
  input: string;
  lastOutput: string;
};

export function getDirectorResponse(input: DirectorRequest): string {
  return `The game world processes your request: "${input.input}"`;
}